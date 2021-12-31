const i = require('./index.js');
const v = require('../config.json');
const data = require('./database');
const r = require('./responses.js');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./modules/shadowrage.db'); // used for lines 26,

async function newMembers() {    //Adds brand new people to the database, without adding duplicates.
    let identifiers = await r.getMemberUUIDs(); //list of uuids
    //console.log(identifiers);
    let members = [];
    for (member in identifiers) {    //uses list of uuids to get usernames.
       let uuid = identifiers[member];
       members.push(uuid);
    }
    for (entryNumber in members) {
       let member = members[entryNumber];
       data.duplicateCheck('uuid', member).then(async dupe => { // adds non-duplicate entries to database.
          if (dupe == false) {
            r.getUsername(member).then(username => {
                db.run('INSERT INTO members(uuid, username, inGuild, weeksPaid, passWeeks) VALUES(?, ?, ?, ?, ?)', [member, username, 'true', 0, 1], function(err) {
                    if (err) console.log('Add new member into database error: '+err);
                    else r.log(username + ' is new to the database. Added.')
                })
            }).catch(err => {
                r.log('getUsername error: '+err);
            });
          }
       });
    }
}

function updateUsernames() {
    // grab list of uuids, use getUsername on em, see if its different than the database, updating if needed.
    return new Promise((resolve, reject) => {
        db.all('SELECT uuid, username FROM members WHERE inGuild = "true"', [], async (err, rows) => {
            if(err) {
                console.log('updateUsernames error: '+err);
                return;
            }
            const update = (rows) => {
                return new Promise(async (resolve, reject) => {
                    let count = 0;
                    for (entry in rows) {
                        let member = rows[entry];
                        let username = await r.getUsername(member.uuid)
                        if (username != member.username) {
                            count = count + 1;
                            db.run('UPDATE members SET username = ? WHERE uuid = ?', [username, member.uuid], (err) => {
                                if (err) {
                                    r.log('updateUsernames failed to update '+member.username+"'s username (to "+username+"). Error: "+err);
                                } else {
                                    r.log(member.username + ' changed their Minecraft username to ' + username + '. Database updated.');
                                }
                            });
                        }
                    }
                    resolve(count);
                });
            }
            let count = await update(rows);
            if (count == 0) {
                r.log('updateUsernames called, but no members have changed their usernames.');
            }
            resolve('updateUsernames finished')
        })
    })
}

module.exports.newMembers = newMembers;
module.exports.updateUsernames = updateUsernames;
//module.exports.