const i = require('./index.js');
const v = require('../config.json');
const sqlite3 = require('../node_modules/sqlite3');
const r = require('./responses.js');
const tax = require('./taxfunctions.js');

const db = new sqlite3.Database('./modules/shadowrage.db');

function adduser (User) {
    let userid = User.id;
    let username = User.username;
    let inguild = 'false';
    db.get('SELECT id, username usern FROM users WHERE id = ? ', [userid], function(err, row) {
        if (err) {
            return(r.log(err));
        }
        if (row == undefined) { // if discord id is unique, not in database.
           console.log('undefined.');
           r.log(username+' new to database. ID and username added.');
           let now = Date.now();
           db.run('INSERT INTO users(id, username, dateadded, inguild, acceptTax) VALUES(?, ?, ?, ?, ?)', [userid, username, now, inguild, 'false'], function(err) {
                if (err) { 
                    return(r.log(err));
                }
            });
        } else if (row.usern != username) {     // to check if username has changed from the one in database.
            let olduser = row.usern;
            db.run('UPDATE users SET username = ? WHERE id = ?', [username, userid], function(err) {
                if (err) return(r.log(err));
                r.log(`${olduser} changed their discord username to ${username}. Database updated.`)
            })
        };
     });
}

function addvalue (User, column) { // adds one to a value in a given column for a given user (currently for how many means, nices, and commands used).
    let query = `SELECT ${column} value FROM users WHERE id = ?`;
    db.get(query, [User.id], function(err, row) {
        if (err) return(r.log('add'+column+' error: '+err));
        if (typeof row == 'undefined') {
            r.log('addvalue error, value grabbed undefined. Error with user ID or column? Inputs (user, column)');
            r.log(User.id+', '+column);
            return;
        }
        let value;
        if (row.value == null) {
            value = 0;
        } else value = row.value;
        let amount = value+1;
        let update = `UPDATE users SET ${column} = ? WHERE id = ?`;
        db.get(update, [amount, User.id], function(err) {
            if (err) return(r.log('add'+column+' error: '+err));
        })
    })
}

function writevalue (table, column, id, value) { //inputs: table name, column name, row id, and value to change to. Changes that value to the input.
    let query = `UPDATE ${table} SET ${column} = ? WHERE id = '${id}'`
    if (column == 'weeksPaid') { //contingency for tax implementation, prevent rewriting of writevalue function
        query = `UPDATE members SET weeksPaid = ? WHERE username LIKE '${id}'`
    } else if (column == 'gexp' || column == 'totalGEXP') {
        query = `UPDATE members SET gexp = ? WHERE uuid = '${id}'`
    } else if (column == 'passWeeks') {
        query = `UPDATE members SET passWeeks = ? WHERE username LIKE '${id}'`
    }
    db.run(query, [value], (err) => {
        if (err) return(r.log("writevalue error: "+err));
        if (column != 'timeuntil') {
            if (column == 'inguild' || column == 'gexp' || column == 'compliment') return;
            r.log(`Wrote '${value}' for id '${id}' in column '${column}' on the '${table}' table.`)
        }
    });
}

const getvalue = (table, column, id) => {
    return new Promise((resolve, reject) => {
        let amount;
        let curamt;
        let array;
        if(Array.isArray(column) == true) {
            array = true;
            amount = [];
        } else array = false;
        let query = `SELECT `;
        if (array == true) {
            for(title in column) {
                query = query.concat(`${column[title]} value${title}, `)
            }
            query = query.substring(0, query.length - 2);
        } else {
            query = query.concat(`${column} value`);
        }
        query = query.concat(` FROM ${table} WHERE id = ?`);
        db.get(query, [id], function(err, row) {
            if (err) reject(err);
            let info = row;
            let arr = 0;
            if (array == true) {
                let arrinfo = Object.values(row);
                let val = `value`;
                while (arr <= column.length) {
                    val = arr;
                    if (arrinfo[val] == null) {
                        curamt = 0;
                    } else curamt = arrinfo[val];
                    amount.push(curamt);
                    val = `value`
                    arr++;
                }
            } else {
                if (info == undefined || info.value == null) {
                    amount = 0;
                } else amount = info.value;
            }
            resolve(amount);
        });
    });
}

const findvalue = (table, column, value) => { //input table column and value, and returns if that value is in that table's column. Returns the row if the value is there.
    return new Promise((resolve, reject) => {
        let found;
        let id; 
        let checkID = 'uuid';
        if (table == 'users') {
            checkID = 'id'
        }
        let query = `SELECT CAST(${checkID} AS text) id FROM ${table} WHERE ${column} = "${value}"`
        //console.log(query);
        db.get(query, [], (err, row) => {
            if (err) {
                r.log("findvalue error: "+err);
                reject(err);
            }
            //console.log(row);
            if (row == undefined) {
                id = "0";
                found = false;
            } else {
                id = row.id;
                found = true;
            }
            let response = [found, id];
            resolve(response);
        })
    })
}

const findvalues = (table, column, value) => { //similar to findvalue, findvalues returns for all that are the value specified.
    return new Promise((resolve, reject) => {
        let id = 'id';
        if (table == 'members') {
            id = 'uuid'
        }
        db.all(`SELECT CAST(${id} AS text) id FROM ${table} WHERE ${column} = "${value}"`, [], function(err, rows) {
            if (err) {
                r.log('findvalues error: '+err);
                reject(err);
            }
            resolve(rows);
        })
    })
}

const guildtime = () => {
    return new Promise(async (resolve, reject) => {
        await r.inguildchecker();
        db.all('SELECT CAST(id AS text) id, guildjointime time FROM users WHERE inguild = "true"', [], function(err, rows) {
            if (err) {
                log('guildtime error: '+err);
                reject(err);
            }
            resolve(rows);
        })
    })
}

function duplicateCheck(column, value) {  //checks for duplicate entries in database. for step 1.
    return new Promise((resolve, reject) => {
       let query = `SELECT username FROM members WHERE ${column} = ?`
       db.get(query, [value], (err, row) => {
          //console.log(row);
          if(err) reject(err);
          if(row == undefined) {
             //console.log('false');
             resolve(false);
          } else {
             //console.log('true');
             resolve(true);
          }
       })
    })
}

function taxGetValue(knownColumn, knownValue, getColumn) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT ${getColumn} value FROM members WHERE ${knownColumn} = ? COLLATE NOCASE`, [knownValue], (err, row) => {
            if (err) { console.log('getValue error: '+err); reject(err); return; }
            if(row == undefined) {
                resolve('invalid input');
            } else {
                resolve(row.value);
            }
        })
    })
}

const updateMembers = () => {    //this function updates the list to show the people currently in the guild and who aren't.
    return new Promise(async (resolve, reject) => {
        let hypixelMembers = await r.getMemberUUIDs();
        db.all('SELECT uuid, inGuild, username FROM members', [], (err, row) => {
            if (err) {
            reject(err);
            }
            //console.log(row);
            for (member in row) {
                let entry = row[member];
                let index = hypixelMembers.indexOf(entry.uuid); //finds where (if somewhere) the uuid in the database is in the updated list from the guild. returns negative if not there.
                //console.log(index);
                if (index >= 0 && entry.inGuild == 'false') { //noted to have left guild, but has rejoined
                    db.run('UPDATE members SET inGuild = ?, passWeeks = ? WHERE uuid = ?', ['true', 1, entry.uuid], (err) => {
                if (err) r.log('rejoin DB update error: ' + err);
                })
                r.log(entry.username + ' has rejoined the guild!');
                } else if (index < 0 && entry.inGuild == 'true') { //noted to be in the guild, but has left
                    db.run('UPDATE members SET inGuild = ? WHERE uuid = ?', ['false', entry.uuid], (err) => {
                if (err) r.log('leave DB update error: ' + err);
                })
                r.log(entry.username + ' has left or been kicked from the guild.');
                }
            }
            resolve();
        //console.log(hypixelMembers);
        })
    })
}

function subtractWeek() {
    db.all('SELECT uuid, weeksPaid FROM members', [], (err, row) => {
       if (err) {
          console.log('grab weeksPaid error: '+err);
          return;
       }
       for (entry in row) {
          let member = row[entry];
          let newWeeks = member.weeksPaid - 1;
          if (newWeeks < -1) newWeeks = -1;
          db.run('UPDATE members SET weeksPaid = ? WHERE uuid = ?', [newWeeks, member.uuid], (err) => {
             if(err) {
                console.log('subtract weeksPaid error: '+err);
                return;
             }
          })
       }
    })
}

const taxList = (weeks) => {
    return new Promise((resolve, reject) => {
        updateMembers().then( () => {
            db.all('SELECT username, inGuild FROM members WHERE weeksPaid = ? ORDER BY username COLLATE NOCASE ASC', [weeks], (err, rows) => {
                if(err) reject(err);
                let list = [];
                for (entry in rows) {
                    let member = rows[entry];
                    if (member.inGuild == 'true') {
                        list.push(member.username);
                    }
                }
                resolve(list);
            })
        }).catch(err => {
            r.log('updateMembers in taxList function error: '+err);
        })
    })
}

const weeksList = () => { //for spreadsheet, generates nested array for each member's uuid, username, inGuild status, and weeksPaid value.
    return new Promise((resolve, reject) => {
        updateMembers().then( () => {
            db.all('SELECT weeksPaid, uuid, username FROM members WHERE inGuild = "true"', [], (err, rows) => {
                let result = [];
                if (err) reject(err);
                for (entry in rows) {
                    let data = rows[entry];
                    let value = [data.uuid, data.username, data.weeksPaid];
                    result.push(value);
                }
                if (result.length > 0) {
                    resolve(result);
                } else {
                    reject('result length 0');
                }
            })
        })
    })
}

const uuidList = () => { //returns list of discord ids and uuids that are marked to be in the guild
    return new Promise(async (resolve, reject) => {
        await r.inguildchecker();
        db.all("SELECT CAST(id AS text) id, uuid FROM users WHERE inguild = 'true'", [], (err, rows) => {
            if(err) reject(err);
            resolve(rows);
        })
    })
}

const uuidNoGuildCheckList = () => {
    return new Promise(async (resolve, reject) => {
        await r.inguildchecker();
        db.all("SELECT CAST(id AS text) id, uuid, inGuild FROM users WHERE uuid IS NOT NULL", [], (err, rows) => {
            if(err) reject(err);
            resolve(rows);
        })
    })
}

const findWeeks = (uuid) => { //given a UUID, the weeksPaid is returned for that UUID in the members table.
    return new Promise((resolve, reject) => {
        db.get('SELECT weeksPaid FROM members WHERE uuid = ?', [uuid], (err, value) => {
            if (err) reject(err);
            if (value == null) {
                reject('invalid uuid');
            } else {
                resolve(value.weeksPaid);
            }
        })
    })
}

const getBotUses = (filter) => {
    return new Promise(async (resolve, reject) => {
        db.all('SELECT COALESCE(uses, 0) uses, COALESCE(mean, 0) mean, COALESCE(love, 0) love, COALESCE(compliment, 0) nice FROM users WHERE id != "197429787684372481"', [], (err, rows) => {
            if(err) reject(err);
            let uses = 0;
            if (filter) {
                for (row in rows) {
                    let entry = rows[row];
                    let amount = entry.uses - (entry.mean + entry.love + entry.nice);
                    uses = uses + amount;
                }
            } else {
                for (row in rows) {
                    let entry = rows[row];
                    uses = uses + entry.uses;
                }
            }
            resolve(uses);
        })
    })
}

const getAllGEXP = () => {
    return new Promise( (resolve, reject) => {
        db.all(`SELECT CAST(uuid AS text) id, gexp, passWeeks FROM members WHERE inGuild = "true"`, [], (err, rows) => {
            if(err) reject(err);
            resolve(rows);
        })
    })
}

const addGEXPWeek = (member, date, gexp, passWeeks) => {
    db.run('INSERT INTO gexp(uuid, dateStored, gexp, passWeeks) VALUES(?, ?, ?, ?)', [member, date, gexp, passWeeks], (err) => {
        if(err) r.log('addGEXPWeek error: '+err);
    })
}

const gexpPastList = () => { //for spreadsheet, generates nested array of the gexp table.
    return new Promise(async (resolve, reject) => {
        db.all('SELECT dateStored, uuid, gexp, passWeeks FROM gexp', [], (err, rows) => {
            if(err) reject(err);
            let output = [];
            let date = Date.now();
            for (index in rows) {
                let member = rows[index];
                output.push([member.dateStored, member.uuid, member.gexp, member.passWeeks, date])
            }
            if (output.length == 0) {
                reject('gexpPastList output array length 0.')
            }
            resolve(output);
        })
    })
}

const gexpList = () => {
    return new Promise(async (resolve, reject) => {
        await updateMembers();
        db.all('SELECT uuid, username, gexp, passWeeks FROM members WHERE inGuild = "true"', [], (err, rows) => {
            if(err) reject(err);
            let output = [];
            for (index in rows) {
                let member = rows[index];
                output.push([member.uuid, member.username, member.passWeeks, member.gexp])
            }
            if (output.length == 0) {
                reject('gexpList output array length 0.')
            }
            resolve(output); 
        })
    })
}

function subtractGEXPPassWeek() {
    db.all('SELECT uuid, passWeeks FROM members', [], (err, row) => {
       if (err) {
          console.log('grab weeksPaid error: '+err);
          return;
       }
       for (entry in row) {
          let member = row[entry];
          let newWeeks = member.passWeeks - 1;
          if (newWeeks < 0) newWeeks = 0;
          db.run('UPDATE members SET passWeeks = ? WHERE uuid = ?', [newWeeks, member.uuid], (err) => {
             if(err) {
                console.log('subtract passWeeks error: '+err);
                return;
             }
          })
       }
    })
}

const leaderboard = (table, sortValue, indexName, resultNumber, minSortValue) => {
    return new Promise(async (resolve, reject) => {
        let query;
        if (table == 'members') {
            query = `SELECT ${sortValue} sort, ${indexName} name FROM ${table} WHERE inGuild = 'true' AND ${sortValue} >= "${minSortValue}" ORDER BY ${sortValue} DESC LIMIT ${resultNumber}`;
        } else { query = `SELECT ${sortValue} sort, ${indexName} name FROM ${table} WHERE ${sortValue} >= "${minSortValue}" ORDER BY ${sortValue} DESC LIMIT ${resultNumber}` }
        db.all(query, [], (err, rows) => {
            if(err) reject(err)
            let output = [];
            for (index in rows) {
                let row = rows[index]
                let push = [row.sort, row.name];
                output.push(push)
            }
            resolve(output);
        })
    })
}

const underList = (req, limit, passWeeks) => {
    return new Promise(async (resolve, reject) => {
        let passQuery = '<'
        if (passWeeks) {
            passQuery = '>='
        }
        await updateMembers();
        let sortDirection = 'DESC'
        if (limit != 200) {
            sortDirection = 'ASC'
        }
        db.all(`SELECT gexp, username FROM members WHERE gexp <= ? AND passWeeks ${passQuery} 1 AND inGuild = "true" ORDER BY gexp ${sortDirection} LIMIT ?`, [req, limit], (err, rows) => {
            if(err) reject(err);
            let output = [];
            for (index in rows) {
                let member = rows[index];
                output.push([member.gexp, member.username])
            }
            resolve(output);
        })
    })
}

const kickList = (req, date) => {
    return new Promise(async (resolve, reject) => {
        let output = [];
        await updateMembers();
        db.all('SELECT uuid, gexp FROM gexp WHERE passWeeks = 0 AND dateStored = ? AND gexp < ? ORDER BY gexp DESC', [date, req], async (err, rows) => {
            if(err) reject(err);
            for (index in rows) {
                row = rows[index];
                output.push([row.uuid, row.gexp])
            }
            resolve(output);
        })
    })
}

const allPastGEXP = () => {
    return new Promise( (resolve, reject) => {
        db.all('SELECT uuid, gexp FROM gexp', [], (err, rows) => {
            if(err) reject(err);
            let output = [];
            for (row of rows) {
                output.push([row.uuid, row.gexp])
            }
            resolve(output)
        })
    })
}

const pastGEXP = (uuid, week) => {
    return new Promise((resolve, reject) => {
        db.all('SELECT gexp FROM gexp WHERE uuid = ? AND dateStored = ?', [uuid, week], (err, rows) => {
            if(err) reject(err);
            let amount = 0;
            for (index in rows) {
                let row = rows[index];
                amount = amount + parseInt(row.gexp)
            }
            resolve(amount);
        })
    })
}

const falseGuildGEXP = () => {
    return new Promise((resolve, reject) => {
        db.all(`UPDATE members SET gexp = ? WHERE inGuild = 'false'`, [0], (err) => {
            if(err) reject(err)
            resolve('success')
        })
    })
}

const uuidAndGuild = () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT uuid, inGuild FROM members', [], (err, rows) => {
            if(err) reject(err)
            let output = [];
            for (row of rows) {
                //let entry = rows[row];
                output.push([row.uuid, row.inGuild])
            }
            if (output.length == 0) reject('uuidAndGuild error: output length 0.')
            resolve(output);
        })
    })
}

const migrateInfo = () => {
    return new Promise((resolve, reject) => {
        const date = Date.now();
        const query = `SELECT uuid, guildjointime FROM users`
        db.all(query, [], (err, rows) => {
            if(err) reject(err);
            const res = [];
            for (const row of rows) {
                if (row.uuid != null && row.guildjointime != null) {
                    res.push(`['${row.uuid}', ${((date - row.guildjointime)/(1000*60*60)).toFixed(0)}]`);
                }
            }
            resolve(res);
        })
    })
}

module.exports.adduser = adduser;
module.exports.addvalue = addvalue;
module.exports.writevalue = writevalue;
module.exports.getvalue = getvalue;
module.exports.findvalue = findvalue;
module.exports.findvalues = findvalues;
module.exports.guildtime = guildtime;
module.exports.duplicateCheck = duplicateCheck;
module.exports.taxGetValue = taxGetValue;
module.exports.updateMembers = updateMembers;
module.exports.subtractWeek = subtractWeek;
module.exports.taxList = taxList;
module.exports.weeksList = weeksList;
module.exports.uuidList = uuidList;
module.exports.uuidNoGuildCheckList = uuidNoGuildCheckList;
module.exports.findWeeks = findWeeks;
module.exports.getBotUses = getBotUses;
module.exports.getAllGEXP = getAllGEXP;
module.exports.addGEXPWeek = addGEXPWeek;
module.exports.gexpPastList = gexpPastList;
module.exports.gexpList = gexpList;
module.exports.subtractGEXPPassWeek = subtractGEXPPassWeek;
module.exports.leaderboard = leaderboard;
module.exports.underList = underList;
module.exports.kickList = kickList;
module.exports.allPastGEXP = allPastGEXP;
module.exports.pastGEXP = pastGEXP;
module.exports.falseGuildGEXP = falseGuildGEXP;
module.exports.uuidAndGuild = uuidAndGuild;
module.exports.migrateInfo = migrateInfo;