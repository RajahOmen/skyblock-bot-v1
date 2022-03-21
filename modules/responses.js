const v = require('../config.json');
const i = require('./index.js');
const g_creds = require(`../client_secret.json`);
const fs = require(`fs`);
const data = require('./database.js');
const tax = require(`./taxfunctions.js`);
const comp = require(`./compliments.json`);
const weight = require(`./weightstuff.js`);
const creds = require('../creds.json');

// functions that do all the calculations, also speaks with hypixel and mojang apis.
// doesn't use discord client, only main.js

const hclient = new i.HypixelAPI(creds.hypixel);

// variables and functions
const delay = () => new Promise(resolve => setTimeout(resolve, 520));

const errmsg = 'Incorrect format or unknown command. Please use `'+v.pref+'help` to show avaliable commands and proper formatting.'
var busy = false;
var longallowed = true;

function calc_xp(profile_data, player_uuid) {
	let stats = profile_data.members[player_uuid];
	let xp = 0;
	for (boss in stats.slayer_bosses) {
		xp += stats.slayer_bosses[boss].xp;
	}
	return xp;
};

async function calc_max_xp(player_uuid) {
	let count = 0;
	let max_retries = 3;
	while(1) {
		try {
			await delay();
			let result = await hclient.getSkyblockProfiles(player_uuid);
			if (!result.success) throw('getSkyblockProfile failed');
			const profiles = result.profiles;
			let xpmax = 0;
			for (profile of profiles) {
				await delay();
				let result = await hclient.getSkyblockProfileData(profile.profile_id);
				if (!result.success) throw ('getSkyblockProfileData failed');
				const profile_data = result.profile;
				let xp = calc_xp(profile_data, player_uuid);
				if (xp > xpmax) xpmax = xp;
			}
			return xpmax;
		} catch (err) {
			count++;
			if (count > max_retries) {
				log(err);
				return NaN;
			}
		}
	}
};

function log(message) {
    let date = new Date;
    let fullDate =  date.toString();
    let timeDate = date.toLocaleTimeString();
    let dateMiddle = fullDate.split(" ")
    let dateLogged = `${dateMiddle[1]} ${dateMiddle[2]} ${timeDate}`
    let logged = `[${dateLogged}] ${message}`;
    console.log(logged);
    fs.appendFile('log.txt', `${logged}\n`, function(err) {
        if (err) return console.error(err);
    });
}; 
/*
async function getSplashTime(msg, user) {       //gets time of next splash, and row in spreadsheet that time is on. Different responses depending on user or bot usage.
    let PST = getPST();
    let dow = PST[0];
    let curhour = PST[1];
    let rows;

    try {
        const doc = new i.gs.GoogleSpreadsheet(`13DnTmrP8d2fk-1p-6t2t-t4HtQOuiWziJZaEkL9ptYA`);      //loading spreadsheet\
        await doc.useServiceAccountAuth(g_creds);
        await doc.loadInfo();
        const sign = doc.sheetsByIndex[5];      //grabbing "splasher signup" sheet
        rows = await sign.getRows({
            offset: 0
        });
    } catch (err) {
        console.log(err);
        throw(err);
    }

    let cell;    //offset to acount for day of week
    //log("Day of week: "+dow);
    switch (dow) {
        case 0:
            cell = (v.splsnum*6);
            break;
        default:
            cell = (v.splsnum*(dow-1));
            break;
    }
    //log("Starting cell (should be first cell of the day it is.): "+(parseInt(cell)+2));

    let done = false;
    let nxtsplsh;
    let oldHour = 0; //for checking if the splash is on the next day.
    for (row in rows) {
        if (done == true) break;
        if (row >= cell) {      //going through each row of days that havn't passed yet
            let tim = rows[row];
            let hour = 0;
            let ampm = tim.Times.slice(6);
            if (ampm == 'AM') {      //controlling for AM and PM
                hour = parseInt(tim.Times.slice(0,2));
                if (hour == 12) {
                    hour = 24;       //turning 12AM (midnight) into 24, for the getHours compatibility
                }
            } else if (ampm == `PM`) {
                hour = 12 + parseInt(tim.Times.slice(0,2));     //adding 12 to make 24hr time
            }
            //log("Row being checked (as it appears in google sheets): "+(parseInt(row)+2)+" Hour displayed: "+tim.Times+" Hour calculated: "+hour);
            if (hour > curhour || oldHour > hour) {
                oldHour = hour;
                nxtsplsh = tim.Times
                done = true;
                let hourstil = hour - (curhour + 1);        //minus 1 more because minutes will bring down the hour count
                let date = new Date;        //JUST FOR GET MINUTES
                let minstil = 60 - date.getMinutes();
                if (user == true) {         //activates when a user calls the command
                    log(`Next splash: ${nxtsplsh} PST`);
                    if (minstil == 60) {        //if exactly on the hour, gets the hours right
                        minstil = 0;
                        hourstil = hourstil + 1;
                    }
                    const splshTime = new i.Discord.MessageEmbed()
                        .setColor(v.hexcolor)
                        .setTitle('Guild God Splashes')
                        .setDescription('All times are in **Pacific Standard Time (PST)**.\nMake sure to convert to your own timezone!')
                        .addFields(
                            { name: 'Next Splash', value: '`' + nxtsplsh + '`'},
                            { name: 'Which is in...', value: '`'+hourstil+` hour(s) and `+minstil+' minute(s)`'}
                        )
                        .setFooter(v.rajsign, v.rajimg);
                    msg.channel.send(splshTime);
                } else if (user == false) {         //activates when the program checks every minute
                    let timetil = ((hourstil)*60) + minstil;
                    //log("Timeuntil: "+timetil+", Row: "+(parseInt(row)+2));
                    let timsplsh = [timetil, parseInt(row)]; // returns array with time until and what number row that splash is on in the spreadsheet.
                    log("getSplash called. Time until splash: "+timsplsh[0]+" minutes. Row of splash on spreadsheet: "+timsplsh[1]+".");
                    return(timsplsh);
                }
            }
        }
    }
}

async function getSplasher(row) {           //gets name of splasher(s) that have signed up for slash on the given row
    try {
        const doc = new i.gs.GoogleSpreadsheet(`13DnTmrP8d2fk-1p-6t2t-t4HtQOuiWziJZaEkL9ptYA`);
        await doc.useServiceAccountAuth(g_creds);
        await doc.loadInfo();
        const sign = doc.sheetsByIndex[5];

        const rows = await sign.getRows({
            offset: row,
            limit: 1
        });

        //log('Input rows:');
        //console.log(rows);

        let data1 = rows[0];
        let data = data1._rawData;
        let splashers = [];
        let anytruths = false;
        for (row in data) {
            //log("Input Row: "+row);
            if (data[row] == "TRUE") {
                anytruths = true;
                splashers.push(v.splasherID[row-2]);
                //log("Output splasher: "+v.splasherID[row-2]);
            }
        }

        if (anytruths == false) {
            log("No splashers signed up for splash for input rows");
        }

        return(splashers);
    } catch (err) {
        log(err);
        return('error');
    }
    
}
*/

function getPST() {     //converts EST time and day to PST time and day
    let EST = new Date;
    let ESThour = EST.getHours();
    let ESTday = EST.getDay();
    let PSThour;
    let PSTday;
    if (ESThour <= 2) {         // setting day if PST and EST don't match
        if (ESTday == 0) {
            PSTday = 6;
        } else {
            PSTday = ESTday - 1;
        }
    } else {
        PSTday = ESTday;
    }
    switch (ESThour) {
        case 0:
            PSThour = 21;
            break;
        case 1:
            PSThour = 22;
            break;
        case 2:
            PSThour = 23;
            break;
        default:
            PSThour = ESThour - 3;
            break;
    }
    let PST = [PSTday, PSThour];
    return(PST);
}

async function uuidrecord(msg, uuid) {
    let result = await data.findvalue('users', 'uuid', uuid)
    let unique = false;
    if (result[0] == false) {
        unique = true;
    } else {
        if (result[1] == msg.author.id) {
            log('uuid already assigned to the person messaging the bot.');
            msg.channel.send('Your username is already assigned to you. If still unable to use the commands, please contact <@'+v.rajid+'>.');
        } else {
            msg.channel.send('This username is assigned to another user. If you believe this is an issue, please contact <@'+v.rajid+'>.');
        }
    }
    return(unique);
}

async function verifyign(ign) {   //returns if an ign is actually a minecraft ign, and the UUID it has. Always an array.
    let isign = false;
    let response;
    let uuid = 0;
    try {
        uuid = await i.MojangAPI.Mojang.getUUID(ign, Date.now());
        if(typeof(uuid) == 'string') {
            isign = true;
        }
    } catch {
        isign = false;
    }
    response = [isign, uuid];
    return(response);
}

function reactions(react, user, splashready, apitimevalue) {
    if (user.id == v.botid) return;
	let msg = react.message;
    let emoji = react.emoji.toString();
    
    if (msg.author.id == "728709928729968690" && msg.channel.id == "732112530151047240" && user.id != v.botid && splashready != 'ready') {	//msg must be by bot, in gsplash chat.
        log(msg.content);
        //log('API Time Value: ')
        /*if (apitimevalue >= 31) {
            log('reaction was recorded, but apitimevalue was too high (>30), so it was ignored.');
            return;
        }*/
        if (msg.content.endsWith('Can but do not have potions.')) {
            switch (emoji) {
                case "✅":
                    msg.channel.send('Thank you <@'+user.id+'> for confirming that you are splashing!');
                    log(user.username+' confirmed splash time.');
                    data.writevalue('info', 'splash', 1, 'ready');
                    break;
                case "❎":
                    msg.channel.send(v.gsplash_splasher+' **HELP!** '+user.username+' cannot splash! React to this message to the message sent by me above (not this one) to sign up for the splash!');
                    r.log(user.username+' alerted gsplashers that they cannot splash.');
                    break;
                case "<:splash:719397434027147265>":				//splash emoji
                    msg.channel.send(v.gsplash_brewer+' **HELP!** '+user.username+' needs potions for the next splash! React to confirm potions will be ready!').then(message => {
                        message.react('✅');
                        log(user.username+' alerted brewers that they can splash, but do not have potions.');
                        data.writevalue('info', 'splash', 1, 'potions');
                    }, err => {
                        log('nopotions error: '+err);
                    });
                    break;
                default:
                    msg.channel.send(`Please react with one of the listed emoji, ty hun <3.`);
                    break;
                }
        }
        if (msg.content.endsWith('React to confirm potions will be ready!')) {
            data.writevalue('info', 'splash', 1, 'ready');
            msg.channel.send('Thank you <@'+user.id+'> for confirming potions will be ready!')
        }
        if (msg.content.endsWith('React to sign up to splash!')) {
            data.writevalue('info', 'splash', 1, 'ready');
            msg.channel.send('Thank you <@'+user.id+'> for signing up to splash!');
        }
	}
}

function getUsername(uuid) {  //input is UUID, returns most recent username. for step 1.
    return new Promise((resolve, reject) => {
       i.MojangAPI.Mojang.getNameHistory(uuid).then(result => {
          let recent = result[result.length - 1];
          let username = recent.name;
          resolve(username);
       }).catch(err => {
          console.log("ERROR: getUsername: " + uuid)
          reject(err);
       });
    })
}

function getMemberUUIDs() { //returns array of member UUIDs
    return new Promise((resolve, reject) => {
        hclient.getGuild('5eb4d01f8ea8c94128915a85').then(result => {
            let objMembers = result.guild.members;
            let members = [];
            for (member in objMembers) {
                let entry = objMembers[member];
                members.push(entry.uuid);
            }
            if (members.length > 0) resolve(members);
            else reject('Member array length less than 1 in length.');
        }).catch(err => {
            console.log(err);
            reject(err);
        })
    })
}

function checkStaff(msg) {
    let userRoles = [];
    if (msg.channel.type == 'dm') {
        msg.channel.send('Please use staff commands in a SHADOWRAGE channel.')
        return(false);
    }
    msg.member.roles.cache.forEach(role => {
        userRoles.push(role.id)
    });
    if (userRoles.indexOf(v.staffRole) < 0) {
        msg.channel.send('This command is for staff only.');
        return(false);
    } else {
        return(true);
    }
}

/*
async function spreadsheetTaxes() {
    const doc = new i.gs.GoogleSpreadsheet(`13DnTmrP8d2fk-1p-6t2t-t4HtQOuiWziJZaEkL9ptYA`);
    await doc.useServiceAccountAuth(g_creds);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[6];
    let array = await data.weeksList();
    if (array.length < 125) {
        let fill = Array(125 - array.length);
        fill.fill(['', '', '']);
        array = array.concat(fill);
    }
    await sheet.loadCells(['A3:C127', 'P3'])
    let values = [];
    for (let i = 0; i < 125; i++) {
        let idCell = sheet.getCell((i + 2), 0);
        let nameCell = sheet.getCell((i + 2), 1);
        let weekCell = sheet.getCell((i + 2), 2);
        idCell.value = array[i][0];
        nameCell.value = array[i][1];
        weekCell.value = array[i][2];
        let entry = [idCell, nameCell, weekCell]
        values.push(entry);
    }
    let dateCell = sheet.getCellByA1('P3');
    dateCell.value = Date.now()
    await sheet.saveUpdatedCells();
    log('Updated tax table in spreadsheet.')
}
*/

async function fishingXP() {
    let theoof = await hclient.getSkyblockProfileData('aa557d3b09b74d4890778365f1e2ba42');
    let fishXP = Math.round(theoof.profile.members.aa557d3b09b74d4890778365f1e2ba42.experience_skill_fishing);
    return(fishXP);
}

const remindDiscordIDs = () => { //returns list of discord IDs that haven't paid fee yet.
    return new Promise(async (resolve, reject) => {
        try {
            let list = await data.uuidList();
            let remindIDs = [];
            for (row in list) {
                let entry = list[row]
                let weeks = await data.findWeeks(entry.uuid)
                if (weeks == 0) {
                    remindIDs.push(entry.id);
                }
            }
            resolve(remindIDs);
        } catch(err) {
            reject(err);
        }
    })
}

const getMemberObject = (client, id) => {    //gets member object from discord id. must be in guild
    return new Promise(async (resolve, reject) => {
        try {
            const guild = await client.guilds.cache.get(v.discordguildid);
            const member = await guild.members.cache.get(id);
            resolve(member);
        } catch (err) {
            reject(err);
        }
    })
}

async function changeRole(client, roleID, discordID, action) { //takes role id, discord id, and action (add/remove). Adds/removes that role from that user.
    let member = await getMemberObject(client, discordID);
    if (member == null) {
        log(action + ' role error (member undefined), IGN probably not linked to discord.');
        return;
    }
    if (member._roles.includes(roleID) == false && action == 'add') {
        if (roleID === '826698213414928387') {
            await member.roles.add(roleID)
        } else {
            log('ROLE ADD DISABLED');
        }
        log("Role '" + roleID + "' added to " + member.user.username);
    } else if (member._roles.includes(roleID) && action == 'remove') {
        // await member.roles.remove(roleID)
        log('ROLE REMOVE DISABLED');
        log("Role '" + roleID + "' removed from " + member.user.username);
    } else if (action == 'add') {
        log(member.user.username + " already has role '" + roleID + "'")
    } else if (action == 'remove') {
        log(member.user.username + " already does not have role '" + roleID + "'");
    }
}

async function getGEXP(id) {
    return new Promise( async (resolve, reject) => {
        try {
            let result = await hclient.getGuild('5eb4d01f8ea8c94128915a85')
            if (result.success) {
                let objMembers = result.guild.members;
                let member = objMembers.find(element => element.uuid == id)
                if (member == null) {
                    reject('Invalid username');
                } else {
                    let day = Object.keys(member.expHistory)
                    //log('expHistory timestamp: ' + day[0]) resets between 11:45PM EST and 12:30AM EST, so probably resets midnight @ 11:59PM / 12:00AM EST
                    let startWeek = await data.getvalue('info', 'curWeek', 1) - (1000*60*60*7); //converting from PST midnight to unix midnight, subtracting 7 hrs
                    let dif = (Date.parse(day[0]) - startWeek)/(1000*60*60*24) + 1; //finding days since start of week.
                    let amount = 0;
                    const array = Object.fromEntries(
                        Object.entries(member.expHistory).slice(0, dif)
                    )
                    for (entry in array) {
                        amount = amount + member.expHistory[entry];
                    }
                    data.writevalue('gexp', 'gexp', member.uuid, amount);
                    resolve(amount);
                }
            } else {
                throw('getGEXP result not success.')
            }
        } catch (error) {
            reject(error);
        }
    })
    
}

async function getAllGEXP() {
    return new Promise( async (resolve, reject) => {
        try {
            let result = await hclient.getGuild('5eb4d01f8ea8c94128915a85')
            if (result.success) {
                let objMembers = result.guild.members;
                let days = Object.keys(objMembers[0].expHistory) //days in expHistory thing
                let startWeek = await data.getvalue('info', 'curWeek', 1) - (1000*60*60*7); //converting from PST midnight to unix midnight, subtracting 7 hrs
                let dif = (Date.parse(days[0]) - startWeek)/(1000*60*60*24) + 1; //finding days since start of week.
                let amount = [];
                for (let index in objMembers) {
                    let member = objMembers[index];
                    let xp = 0;
                    const dayXPArray = Object.fromEntries(
                        Object.entries(member.expHistory).slice(0, dif)
                    )
                    for (let index in dayXPArray) {
                        xp = xp + dayXPArray[index];
                    }
                    amount.push([member.uuid, xp]);
                }
                resolve(amount);
            } else {
                throw('getAllGEXP result not success.')
            }
        } catch (error) {
            reject(error);
        }
    })   
}

const updateAllGEXP = () => {
    return new Promise(async (resolve, reject) => {
        let startWeek = await data.getvalue('info', 'curWeek', 1) - (1000*60*60*7); //converting from PST midnight to unix midnight, subtracting 7 hrs
        if ((Date.now - startWeek) > 1000*60*60*24*7) { //checking if the weekly function was called. If it hasn't return, so it doesn't overwrite the gexp value in members table before transcribing
            resolve('weekly function did not call, skipping updateAllGEXP.');
        } else {
            let memberXPArray;
            try { memberXPArray = await getAllGEXP() } catch (err) { reject(err) }
            for (index in memberXPArray) {
                let member = memberXPArray[index];
                data.writevalue('members', 'gexp', member[0], member[1]);
            }
            resolve("Updated all gexp values in the 'members' table.");
        }
    })
}

async function writePastGEXPWeeks(time) {
    let dupeCheck = await data.findvalue('gexp', 'dateStored', time)
    if (dupeCheck[0]) {
        log("writePastGEXPWeeks was called, but the week already exists in the 'gexp' table.");
        return;
    } else {
        await tax.newMembers();
        await data.updateMembers();
        let members = await data.getAllGEXP();
        for (member of members) {
            data.addGEXPWeek(member.id, time, member.gexp, member.passWeeks);
        }
        log('Added past week to gexp table.')
    }
}

/*
async function gexpPastSpreadsheet() {
    let dataToWrite;
    try {
        dataToWrite = await data.gexpPastList();
    } catch (err) {
        log('gexpPastList error: ' + err);
        return;
    }
    const doc = new i.gs.GoogleSpreadsheet(`13DnTmrP8d2fk-1p-6t2t-t4HtQOuiWziJZaEkL9ptYA`);
    console.log(doc);
    await doc.useServiceAccountAuth(g_creds);
    await doc.loadInfo();
    console.log(doc);
    const sheet = doc.sheetsByIndex[4];
    const rows = await sheet.getRows();
    let dupeCheck = false;
    for (row in rows) {
        let value = rows[row];
        if (value.weekTime == dataToWrite[0][0]) dupeCheck = true;
    }
    if (dupeCheck) {
        log('gexpSpreadsheet called, but the latest date is already recorded in the spreadsheet, skipped.')
        return;
    }
    sheet.addRows(dataToWrite);
    log('gexpSpreadsheet function completed, spreadsheet updated.')
}

async function gexpSpreadsheet() {
    const doc = new i.gs.GoogleSpreadsheet(`13DnTmrP8d2fk-1p-6t2t-t4HtQOuiWziJZaEkL9ptYA`);
    await doc.useServiceAccountAuth(g_creds);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[3];
    await sheet.loadCells(['A2:E126', 'F3']);
    let array;
    try { array = await data.gexpList(); } catch(err) { log(err); return; }
    if (array.length < 125) {
        let fill = Array(125 - array.length);
        fill.fill(['', '', '']);
        array = array.concat(fill);
    }
    let values = [];
    let timeCell = sheet.getCell(2, 5)
    timeCell.value = Date.now();
    for (let i = 0; i < 125; i++) {
        let idCell = sheet.getCell((i + 1), 0);
        let nameCell = sheet.getCell((i + 1), 1);
        let newMemberCell = sheet.getCell((i + 1), 2);
        let gexpCell = sheet.getCell((i + 1), 3);
        let passCell = sheet.getCell((i + 1), 4);
        idCell.value = array[i][0];
        nameCell.value = array[i][1];
        newMemberCell.value = array[i][2];
        gexpCell.value = array[i][3];
        passCell.value = array[i][4]
        let entry = [idCell, nameCell, newMemberCell, gexpCell, passCell]
        values.push(entry);
    }
    await sheet.saveUpdatedCells();
    log('Updated current gexp spreadsheet table.')
}
*/

const totalGEXPLeaderboard = (limit) => {
    return new Promise(async (resolve, reject) => {
        let currentGEXP, pastGEXP;
        try { currentGEXP = await data.leaderboard('members', 'gexp', 'uuid', 125, 0); pastGEXP = await data.allPastGEXP() } catch(err) { reject(err) }
        let totalArray = [];
        
        for (member of currentGEXP) { //iterating through people in 'members' table
            totalArray.push([member[0], member[1]])
            let index = totalArray.length - 1;
            for (entry of pastGEXP) {   //iterating through people in 'gexp' table
                if (entry[0] == member[1]) {
                    let pastVal = totalArray[index][0]
                    totalArray[index][0] = entry[1] + pastVal
                }
            }
        }
        let sortedArray = totalArray.sort((a, b)=>{return (b[0] - a[0])}) //sorting
        let finalArray = [];
        for (value of sortedArray) {
            let username = await data.taxGetValue('uuid', value[1], 'username')
            let num = value[0];
            let numval;
            if (num >= 1000000000000) {
                numval = `${(Math.round(num / 10000000000)) / 100}T`
            } else if (num >= 1000000000) {
                numval = `${(Math.round(num / 10000000)) / 100}B`
            } else if (num >= 1000000) {
                numval = `${(Math.round(num / 10000)) / 100}M`
            } else {
                numval = `${Math.round(num / 1000)}k`
            }
            finalArray.push([numval, username])
        }
        resolve(finalArray.slice(0, limit));
    })
}

const notGuildMemberGEXPRemove = async () => { //run when week ends, sets anyone who isn't in the guild's gexp to 0.
    try { await data.falseGuildGEXP(); log('Reset GEXP of members no longer in guild') } 
    catch(err) { log('notGuildMemberGEXPRemove error: '+err) }
}

const GEXPRole = () => {
    return new Promise(async (resolve, reject) => {
        try {
            let remindIDs = [];
            let list = await data.uuidNoGuildCheckList();
            console.log(list);
            for (row in list) {
                let member = list[row];
                let xp = await data.taxGetValue('uuid', member.uuid, 'gexp')
                if (xp < v.gexpReq) {
                    remindIDs.push(member.id);
                }
            }
            /*for (id of remindIDs) {
                changeRole(client, '', id, add)
            }*/
        } catch(err) {
            reject(err)
        }

    })
}

// responses to queries
function help(msg) {
    const helpEmbed = new i.Discord.MessageEmbed()
        .setColor(v.hexcolor)
        .setTitle('Guild Commands')
        .setAuthor(v.botname, v.botimg)
        .setDescription('Use `'+v.pref+'help [command name]` for info on a command.')
        .addFields(
            { name: 'USEFUL COMMANDS', value: "```"+`${v.pref}help (command)\n${v.pref}xp (IGN) (weeks in past)\n${v.pref}xptop (total) (leaderboard size)\n${v.pref}verify [IGN]\n${v.pref}slayerxp [IGN]\n${v.pref}guildxp [XP]\n${v.pref}stop\n${v.pref}profiles [IGN]\n${v.pref}rank (IGN)`+"```"},
            { name: 'LESS USEFUL COMMANDS', value: "```"+`${v.pref}fuck\n${v.pref}fuckamount\n${v.pref}love\n${v.pref}compliment\n${v.pref}uses (true / false)`+"```"},
            { name: 'STAFF COMMANDS', value: "```"+`${v.pref}duelist (leaderboard size)\n${v.pref}kicklist (gexp amount) (weeks past)\n${v.pref}pass [ign] (weeks)\n${v.pref}passlist (weeks)`+"```"}
        )
        .setFooter(v.rajsign, v.rajimg);
    msg.channel.send(helpEmbed);
};

function helpinfo(msg, com) {
    let command = com[1]
    if (v.commandInfo[command] == null) {
        msg.channel.send(command + " is not a command.")
        return;
    }
    let helpMessage = new i.Discord.MessageEmbed()
        .setTitle('Command Information')
        .setColor(v.hexcolor)
        .addFields({
            name: "Command: "+"`"+`${v.pref}${command}`+"`", value: v.commandInfo[command]
        })
    msg.channel.send(helpMessage);
}

function skillaverage(msg, com) {
    const name = com[1];
    hclient.getSkyblockProfiles('name', name).then(result => {
        if (result.success) {
            let profarr = [``]; 
            for (const profile of result.profiles) {
                profarr.push(profile.cute_name);
            }
        }
    }).catch(reason => {
        msg.channel.send(errmsg);
        log("getSkyblockProfiles failed: " + reason);
    });
}

function profiles(msg, com) {
    const name = com[1];
    hclient.getSkyblockProfiles('name', name).then(result => {
        if (result.success) {
            let profarr = [``]; 
            for (const profile of result.profiles) {
                profarr.push(profile.cute_name);
            }
            i.MojangAPI.Mojang.getUUID(name).then(result => {
                let uuid = result;
                const profileEmbed = new i.Discord.MessageEmbed()
                    .setColor(v.hexcolor)
                    .setTitle(`Skyblock Profiles`)
                    .setAuthor(name, `https://crafatar.com/avatars/${uuid}?size=128&default=MHF_Steve&overlay`)
                    .addFields(
                        { name: profarr, value: "Yummy Fruit ^v^"},
                    )
                    .setFooter(v.rajsign, v.rajimg);
                msg.channel.send(profileEmbed);
                log(`${v.botname}: Sent ${name}'s cute_names`);
            });	
        }
    }).catch(reason => {
        msg.channel.send(errmsg);
        log("getSkyblockProfiles failed: " + reason);
    });
};

function mean(msg, com) {
    if (msg.author.username == "Rajah" || com[1] == "rajah" || com[1] == "Rajah") {
        let choice = Math.floor(Math.random()*v.nice.length);
        log(v.nice[choice]);
        if (v.nice[choice] == "cosa1") {
            if (msg.author.username == "Rajah") {
                msg.reply("", {files: [`https://i.imgur.com/XmCHFqa.jpg`]});
            } else {
                msg.channel.send(`> sr fuck ${com[1]}\n${v.nice[choice]}`, {files: [`https://i.imgur.com/XmCHFqa.jpg`]})
            }
        } else {
            if (msg.author.username == "Rajah") {
            msg.reply(v.nice[choice]);
            } else {
                msg.channel.send(`> sr fuck ${com[1]}\n${v.nice[choice]}`)
            }
        }
    } else {
        let choice = Math.floor(Math.random()*v.mean.length);
        if (v.mean[choice] == "cosa7") {
            msg.reply("", {files: [`https://i.imgur.com/ww8HFRx.jpg`]});
        } else if (v.mean[choice] == 'dark4') {
            msg.reply("", {files: [`https://i.imgur.com/tDjKqZa.jpg`]});
        } else if (v.mean[choice] == 'tea') {
            msg.reply("", {files: [`https://i.imgur.com/KhHT2hc.png`]});
        }
        else {
            msg.reply(v.mean[choice]);
        }
    }
};

function stop(msg) {
    if (busy === false) {
        const noStopEmbed = new i.Discord.MessageEmbed()
            .setColor(v.hexcolor)
            .setTitle(`No command running.`)
            .setAuthor(v.botname, v.botimg)
            .setFooter(v.rajsign, v.rajimg);
        msg.channel.send(noStopEmbed);
    }
	longallowed = false;
	busy = false;
	const stopEmbed = new i.Discord.MessageEmbed()
		.setColor(v.hexcolor)
		.setTitle(`Command canceled.`)
		.setAuthor(v.botname, v.botimg)
		.setFooter(v.rajsign, v.rajimg);
	msg.channel.send(stopEmbed);
};

function verify(msg, com) {
	if (msg.channel.type != 'text') {
        msg.channel.send(`Verify guild membership in #🤖-‖-commands channel in the ${v.botname} discord server.`);
        return;
    }
    let ign = com[1];
    let username = msg.author;
    let user = (username.username+`#`+username.discriminator);
    hclient.getPlayer('name', ign).then(result => {
        if (result.success) {
            let dis1 = "";
            try {
                dis1 = result.player.socialMedia.links.DISCORD;
                ign = result.player.displayname;
            }
            catch {
                const nodiserrEmbed = new i.Discord.MessageEmbed()
                    .setColor(v.hexcolor)
                    .setTitle(`Discord account not connected to Hypixel.\nTry again in a few minutes.`)
                    .setAuthor(v.botname, v.botimg)
                    .setFooter(v.rajsign, v.rajimg);
                msg.channel.send(nodiserrEmbed);
                log(v.botname+`: No Discord account linked.`);
            }
            if (dis1 === user) {
                hclient.findGuild('memberName', ign).then(result => {
                    if (result.success) {
                        if (result.guild === `5eb4d01f8ea8c94128915a85`) {
                            let vbfore = msg.member.roles.cache.find(role => role.name === v.vrole);
                            if (vbfore != undefined) {
                                const vdisbEmbed = new i.Discord.MessageEmbed()
                                    .setColor(v.hexcolor)
                                    .setTitle(`${ign} is already verified.`)
                                    .setAuthor(v.botname, v.botimg)
                                    .setFooter(v.rajsign, v.rajimg);
                                log(v.botname+`: `+user+` has previously verified `+ign+` is their Minecraft account in SHADOWRAGE.`);
                                msg.channel.send(vdisbEmbed);
                                return;
                            }
                            try {
                                let mrole = msg.member.roles.highest;
                                let brole = msg.guild.roles.cache.find(brole => brole.name === 'Bots');
                                if (mrole.position >= brole.position) {
                                    throw('No Permission.');
                                } else msg.member.setNickname(ign);
                            }
                            catch(err) {
                                log(v.botname+`: setNickname error: `+err);
                            }
                            try {
                                let role = msg.guild.roles.cache.find(role => role.name === v.vrole);
                                // msg.member.roles.add(role);
                            } catch(err) {
                                log(`assignRole failed: `+err);
                            }
                            const gdissucEmbed = new i.Discord.MessageEmbed()
                                .setColor(v.hexcolor)
                                .setTitle(`${ign} Verified!`)
                                .setDescription(`Welcome to ${v.botname}!`)
                                .setAuthor(v.botname, v.botimg)
                                .setFooter(v.rajsign, v.rajimg);
                            log(v.botname+`: `+user+` verified that `+ign+` is their Minecraft account in SHADOWRAGE.`);
                            msg.channel.send(gdissucEmbed);
                            i.MojangAPI.Mojang.getUUID(ign, Date.now()).then(uuid => {
                                data.writevalue('users', 'ign', msg.author.id, ign);
                                data.writevalue('users', 'uuid', msg.author.id, uuid);
                            }).catch(err => {
                                log("getUUID in verification function error: "+err)
                            })
                        } else {
                            const g2diserrEmbed = new i.Discord.MessageEmbed()
                                .setColor(v.hexcolor)
                                .setTitle(`${ign} is not in SHADOWRAGE.`)
                                .setAuthor(v.botname, v.botimg)
                                .setFooter(v.rajsign, v.rajimg);
                            msg.channel.send(g2diserrEmbed);
                            log(v.botname+`: `+user+` is `+ign+`, but they are not in SHADOWRAGE.`)
                        }
                    }
                }, reject => {
                    log(`findGuild failed: `+reject);
                    const gdiserrEmbed = new i.Discord.MessageEmbed()
                        .setColor(v.hexcolor)
                        .setTitle(`${ign} is not in a guild.`)
                        .setAuthor(v.botname, v.botimg)
                        .setFooter(v.rajsign, v.rajimg);
                    msg.channel.send(gdiserrEmbed);
                });
            } else {
                const diserrEmbed = new i.Discord.MessageEmbed()
                        .setColor(v.hexcolor)
                        .setTitle(`${ign} is not `+ign+`'s Discord account.`)
                        .setAuthor(v.botname, v.botimg)
                        .setFooter(v.rajsign, v.rajimg);
                msg.channel.send(diserrEmbed);
                log(v.botname+`: ${user} is not `+ign+`'s Discord account.`);
            }
        }
    }, reject => {
        log(`getPlayer failed: `+reject);
        msg.channel.send(`Invalid input or format. Please try again or use **${v.pref}help** for command format.`);
    });
};

function slayerxp(msg, com) {
	const user = com[1];
    console.log("hi")
    const slayerEmbed = new i.Discord.MessageEmbed()
    .setColor(v.hexcolor)
    .setTitle(`Slayer XP Statistics`)
    .addFields(
        { name: `Total Slayer xp`, value: "-5 + nice pb + bozo + L + ratio"},
        { name: `Command WIP`, value: `Slayer XP breakdown never.`}
    )
    .setFooter(v.rajsign, v.rajimg);
    msg.channel.send(slayerEmbed);
    return;
    try {
        i.MojangAPI.Mojang.getUUID(user, Date.now()).then(resolve => {
            console.log("hihi")
            if (typeof(resolve) == "string") {
                const uuid = resolve;
                console.log("hihi")
                calc_max_xp(uuid).then(resolve => {
                console.log("hihdi")
                const xp = resolve;
                const slayerEmbed = new i.Discord.MessageEmbed()
                    .setColor(v.hexcolor)
                    .setTitle(`Slayer XP Statistics`)
                    .setAuthor(user, `https://crafatar.com/avatars/${uuid}?size=128&default=MHF_Steve&overlay`)
                    .addFields(
                        { name: `Total Slayer xp`, value: xp},
                        { name: `Command WIP`, value: `Slayer XP breakdown coming soon™`}
                    )
                    .setFooter(v.rajsign, v.rajimg);
                log(`${v.botname}: ${user} has ${xp} XP`)
                msg.channel.send(slayerEmbed);
                });
            }
        }, reject => {
            log(`SlayerXP failed: ${reject}`);
            msg.channel.send(errmsg);
        }).catch(error => {
            console.log("Slayer XP error: " + error)
        });	
    } catch(error) {
        console.log(error);
    }
};

function guildxp(msg, com) {
    if (busy === true) {
        return(msg.channel.send(`I'm busy with a long command right now, please try again in a few minutes.`));
    }
    longallowed = true;
    let req = parseInt(com[1]);
    if (isNaN(req)) {
        msg.channel.send(errmsg);
        return;
    }
    hclient.getGuild(v.guildid).then(async result =>{
        if (result.success) {
            let namelist = [`GUILD MEMBER      SLAYER XP`];
            let bar = 0;
            busy = true;
            const gxpstart = new i.Discord.MessageEmbed()
                .setColor(v.hexcolor)
                .setAuthor(v.botname, v.botimg)
                .setTitle(`GuildXP Command Started`)
                .addFields(
                    {name: `Slayer XP Threshold`, value: `${req} XP`},
                    {name: `This command takes time`, value: `Use **${v.pref}stop** to cancel.`},
                    {name: `Progress`, value: '`'+v.barblank.repeat(v.barlength)+'`'}
                )
                .setFooter('From Rajah, with <3', v.rajimg);
            let prog;
            prog = await msg.channel.send(gxpstart);
            const memamount = result.guild.members.length;
            let pos = 0;
            let alter = 1;
            let maxslayer = 0;
            let maxslayeruser = "0";
            let barold = 0;
            log(`${v.botname}: START: ${v.pref}guildxp ${req} from ${msg.author.username}`);
            for (const member of result.guild.members) {
                pos++;
                barold = bar;
                if (pos > Math.floor(memamount/v.barlength) && alter == 1) {
                    bar++;
                    alter = 0;
                    pos = 0;
                } else if (pos >= Math.floor(memamount/v.barlength) && alter == 0) {
                    bar++;
                    alter = 1;
                    pos = 0;
                }
                if (longallowed == false) {
                    const gxpcan = new i.Discord.MessageEmbed()
                        .setColor(v.hexcolor)
                        .setAuthor(v.botname, v.botimg)
                        .setTitle('~~GuildXP Command Started~~')
                        .addFields(
                            {name: `Command cancelled`, value: `Use **${v.pref}guildxp** for command`},
                            {name: `Progress`, value: '`'+i.sprintf(`%-${v.barlength}s`, v.barimg.repeat(bar))+'`'}
                        )
                        .setFooter(v.rajsign, v.rajimg);
                    prog.edit(gxpcan);
                    return;
                }
                const gxpduring = new i.Discord.MessageEmbed()
                    .setColor(v.hexcolor)
                    .setAuthor(v.botname, v.botimg)
                    .setTitle(`GuildXP Command Started`)
                    .addFields(
                        {name: `Slayer XP Threshold`, value: `${req} XP`},
                        {name: `This command takes time`, value: `Use **${v.pref}stop** to cancel.`},
                        {name: `Progress`, value: '`'+i.sprintf(`%-${v.barlength}s`, v.barimg.repeat(bar))+'`'}
                    )
                    .setFooter(v.rajsign, v.rajimg);
                if (barold != bar) prog.edit(gxpduring);
                let xp = await calc_max_xp(member.uuid);
                if (xp < req) {
                    i.MojangAPI.Mojang.getNameHistory(member.uuid).then(result => {
                        const names = result;
                        const name = names[names.length - 1];
                        let pentry = i.sprintf('%-18s', name.name);
                        const sxp = xp.toString();
                        let entry = pentry.concat(i.sprintf(`%9s`, sxp));
                        namelist = namelist.concat(entry);
                    }).catch(() => {
                        console.log("ERROR: GETGUILD");
                    });
                }
                if (xp > maxslayer) {
                    maxslayer = xp;
                    i.MojangAPI.Mojang.getNameHistory(member.uuid).then(result => {
                        const names = result;
                        const name = names[names.length - 1];
                        maxslayeruser = name.name;
                    }).catch(() => {
                        console.log("ERROR: GETGUILD2");
                    });
                }
            }
            log(`${v.botname}: HighestUser: ${maxslayeruser}, ${maxslayer}`)
            log(`FINISH: ${v.botname}: ${v.pref}guildxp ${req} from ${msg.author.username}`);

            let namelists = namelist.join('\n');
            leaderboardMessage(msg, namelists, 'GuildXP Command Finished', 'Guild Members Under Threshold', `Threshold: ${req}`, 0)
                /*.setColor(v.hexcolor)
                .setTitle('GuildXP Command Finished')
                .setAuthor(v.botname, v.botimg)
                .addFields(
                    { name: 'Slayer XP Threshold', value: `${req} XP`},
                    { name: 'Guild Members Under Threshold', value: '```'+namelists+'```'},
                    { name: 'Top Guild Member Slayer XP', value: `**${maxslayeruser}** with **${maxslayer} XP**`}
                )
                .setFooter(v.rajsign, v.rajimg)
            msg.channel.send(guildxpEmbed);*/
            busy = false;
        }
    }, reason => {
        log("getGuild failed: " + reason);
    });
};

function love(msg) {
    data.addvalue(msg.author, 'love');
    data.getvalue('users', 'love', msg.author.id).then(amt => {
        if (msg.author.username == "Rajah") {
            msg.reply(`I love you x♾️`)
        } else {
            msg.reply(`I love you x${amt+1}`);
        }
    })
    .catch(err => {
        log("love error: "+err);
    })
};

function movesplash(msg) {
    if (v.staffchannels.indexOf(msg.channel.id) >= 0) {
        data.writevalue('info', 'splash', 1, 'ready');
        msg.channel.send('Next splash automatic notifications disabled.');
    } else {
        msg.channel.send('Use in a staff-only channel.');
    }
}

function fuckamount(msg) {
    data.getvalue('users', 'mean', msg.author.id)
        .then(amt => {
            if (msg.author.username == "Rajah") {
                msg.reply(`damn, you've offered ${amt} times! I'm overwhelmed!`);
            } else {
                switch (amt) {
                    case 0:
                        msg.reply(`you havn't offered yourself to me yet. You'll never know just how much you're missing out.`);
                        break;
                    case 1:
                        msg.reply(`you've begged for me ${amt} time. Kinda sad you thought you had a chance, imo.`);
                        break;
                    default:
                        msg.reply(`you've begged for me ${amt} times. Pretty desperate, don't you think?`);
                        break;
                }
            } 
        })
        .catch(err => {
            log("getvalue error: "+err);
        })
}

function ignmessage(msg) {
    return new Promise((resolve, reject) => {
        let haveign;
        data.getvalue('users', 'ign', msg.author.id).then(ign => {
            if (ign == 0) {
                haveign = false;
            } else {
                haveign = true;
            }
            resolve(haveign);
        }).catch(err => {
            reject(err);
        })
    });
}

async function usernameinput(msg, com) {
    let verify = await verifyign(com[1]);
    if (verify[0] == false) {
        msg.channel.send('Invalid username.')
    } else {
        uuidrecord(msg, verify[1]).then(async datacheck => {
            if (datacheck == true) {
                data.writevalue('users', 'ign', msg.author.id, com[1]);
                data.writevalue('users', 'uuid', msg.author.id, verify[1]);
                msg.channel.send("Thank you for submitting your username! You can now use the bot's features")
                await tax.newMembers();
                await inguildchecker();
                try {
                    let inGuild = await data.getvalue('users', 'inguild', msg.author.id);
                    if (inGuild) {
                        let weeks = await data.findWeeks(verify[1]);
                        /*if (weeks < 1) {
                            changeRole(msg.client, v.remindRole, msg.author.id, 'add');
                            log('Added remind role to person who entered their IGN after the update period! Success!')
                        }*/
                    }   
                } catch(err) {
                    log('error adding remind role to new discord member: ' + err)
                }
            }
        })
    }
}

function say(msg, com) {
    if (msg.author.id == v.rajid) {
        let input = com[1];
        let chan;
        let message = com;
        let dm = false;
        switch(input) { //tests to see if use a text response or a channel ID.
            case "general":
                chan = v.channelID[0];
                break;
            case "commands":
                chan = v.channelID[1];
                break;
            case "dm":
                chan = com[2];
                message.shift();
                dm = true;
                break;
            default:
                chan = com[1];
                break;
        }

        message.shift();
        message.shift();
        message = message.join(" "); //removes the first two entries and makes returns message with spaces.

        if(dm) {
            msg.client.users.fetch(chan).then(rechan => {
                rechan.send(message);
                msg.channel.send('Sent `'+message+'` in `'+rechan.username+"'s DMs`");
                log(v.botname+": Sent '"+message+"' in "+rechan.username+"'s DMs.");
            }).catch(err => {
                log("say command error: "+err);
            });
        } else {
            msg.client.channels.fetch(chan).then(rechan => {
                rechan.send(message);
                msg.channel.send('Sent `'+message+'` in `'+rechan.name+'`');
                log(v.botname+": Sent '"+message+"' in '"+rechan.name+"'.");
            }).catch(err => {
                log("say command error: "+err);
            });
        }

    }
}

async function inguildchecker() { //checks for people in guild, adds 'inguild' and 'guildjointime' columns.
    let result = await hclient.getGuild(v.guildid)
    let members = result.guild.members;
    for (member of members) {
        let indata = await data.findvalue('users', 'uuid', member.uuid);
        if(indata[0]) {
            data.writevalue('users', 'inguild', indata[1], 'true');
            let datajoin = await data.getvalue('users', 'guildjointime', indata[1])
            if(datajoin == 0) {
                data.writevalue('users', 'guildjointime', indata[1], member.joined);
            }
        }
    }
    let trues = await data.findvalues('users', 'inguild', 'true');
    for (entry of trues) {
        let stillin = false;
        let uuid = await data.getvalue('users', 'uuid', entry.id);
        for (member of members) {
            if (member.uuid == uuid) {
                stillin = true;
                break;
            }
        }
        if (stillin == false) {
            log("Member with uuid: "+uuid+" was in the guild, but has now been recorded to have left.");
            data.writevalue('users', 'inguild', entry.id, 'false');
        }
    }
}

async function tierrole(guild) {
    //console.log(guild);
    //let guildmembers = await tierMemberRoleUtility(guild);
    let result = await data.guildtime();
    let guildmembers = [];
    let memberObj = await guild.members.fetch();
    for (member of memberObj) {
        let guildmember = {id: member[1].user.id, roles: member[1]._roles};
        guildmembers.push(guildmember);
    }
    for (val of result) {
        const correctid = (element) => element.id == val.id;
        let place = guildmembers.findIndex(correctid)
        if (place > -1) {
            let arraymem = guildmembers[place];
            let roles = arraymem.roles;
            let member = await guild.members.fetch(arraymem.id);
            //console.log(member.user.username);
        
            
            let timepass = Date.now() - val.time;
            let months = timepass/2592000000; //big number is miliseconds in 30 days
            let tier;
            
            if (months < 0.5) { //stone
                tier = 1;
            } else if (months >= 0.5 && months < 1) { //coal
                tier = 2;
            } else if (months >= 1 && months < 2) { //iron
                tier = 3;
            } else if (months >= 2 && months < 4) { //gold
                tier = 4;
            } else if (months >= 4 && months < 6) { //lapis
                tier = 5;
            } else if (months >= 6 && months < 8) { //redstone
                tier = 6;
            } else if (months >= 8 && months < 10) { //emerald
                tier = 7;
            } else if (months >= 10 && months < 12) { //diamond
                tier = 8;
            } else if (months >= 12) { //obsidian
                tier = 9;
            }
            let roleid = v.tierroles[(tier - 1)]
            //if (roles.includes(roleid)) break; //exits if the role is already assigned to the member.

            if (roles.includes(roleid) == false && roles.includes('708164018384404492')) {
                let currole = [];
                for (id of v.tierroles) {
                    if (roles.includes(id)) {
                        currole.push(id);
                    }
                }
                if (currole.length > 0) {
                    //console.log(currole);
                    let roleChanges = [];
                    let roleString = '';
                    for (role of currole) {
                        roleChanges.push(changeRole(guild.client, role, member.user.id, 'remove'))
                        roleString.concat(`${role}, `)
                    }
                    roleString = roleString.slice(0, -2);
                    try {
                        await Promise.all(roleChanges);
                        log(`Removed role(s) ${currole} from ${member.user.username}`);
                    } catch (err) {
                        log(`Error removing roles from ${member.user.username}: ${err}`);
                    }
                }
                try {
                    await changeRole(guild.client, roleid, member.user.id, 'add')
                    log('Added a tier '+(tier - 1)+' role to '+member.user.username);
                } catch (err) {
                    log(`Error adding role to ${member.user.username}: ${err}`);
                }
            }
        }
    }
}

async function addWeek(msg, com) { //adds weeksPaid to person based on username.
    let userRoles = [];
    msg.member.roles.cache.forEach(role => {
        userRoles.push(role.id)
    });
    if (userRoles.indexOf(v.taxAcceptRole) < 0) {
        msg.channel.send('Spreadsheet Assistants Only.');
        return;
    }
    if (v.staffchannels.indexOf(msg.channel.id) < 0) {
        msg.channel.send('Use in a staff channel.');
        return;
    }
    await tax.newMembers();
    await data.updateMembers();
    let weeksAdded;
    let username = com[1];
    if (com.length == 2) {
        weeksAdded = 1;
    } else {
        weeksAdded = parseInt(com[2]);
    }
 
    //make sure to add staff only functionality!
    let weeksPaid = await data.taxGetValue('username', username, 'weeksPaid')

    if (weeksPaid != 'invalid input') {
        let newWeeks = weeksPaid + weeksAdded;
        if (newWeeks < -1) newWeeks = -1;
        if (newWeeks != weeksPaid) {
            msg.channel.send('Added '+weeksAdded+' week(s) to '+username+'. They have now paid for '+newWeeks+' week(s).')
            data.writevalue('members', 'weeksPaid', username, newWeeks);
            let check = await data.taxGetValue('username', username, 'weeksPaid')
            if (check == newWeeks) {
                log('Added '+weeksAdded+' week(s) to '+username+'. They have now paid for '+newWeeks+' week(s).');
            } else {
                log('Internal error, please try again. If the problem persists, ping Rajah.');
            }
            if (newWeeks > 0 && weeksPaid <= 0) { // deals with the remind role, removes it if a payment has been recorded.
                let id = await data.findvalue('users', 'ign', username)
                await changeRole(msg.client, v.remindRole, id[1], 'remove')
            } else if (weeksPaid > 0 && newWeeks <= 0) {
                let id = await data.findvalue('users', 'ign', username)
                await changeRole(msg.client, v.remindRole, id[1], 'add')
            }
        } 
    } else {
        msg.channel.send('Username invalid. Check spelling, and if the member recently changed their name.'); 
    }
}

async function getWeeks(msg, com) {
    await tax.newMembers();
    await data.updateMembers();
    let username;
    if (com.length > 1) {
        username = com[1];
    } else {
        username = await data.getvalue('users', 'ign', msg.author.id);
    }
    let weeksPaid = await data.taxGetValue('username', username, 'weeksPaid');
    let inGuild = await data.taxGetValue('username', username, 'inGuild');
    if (weeksPaid != 'invalid input') {
        if (inGuild == 'true') {
            switch(weeksPaid) {
                case -1:
                    msg.channel.send(username + " did not pay for last weeks fee before the deadline.");
                    break;
                case 0:
                    msg.channel.send(username + " has not paid this week's fee! Contact staff or ping the Spreadsheet Assistant role to pay.");
                    break;
                case 1:
                    msg.channel.send(username + " has paid this week's fee.");
                    break;
                default:
                    msg.channel.send(username + ' has paid for ' + weeksPaid + ' week(s).');
                    break;
            }
        } else {
            msg.channel.send(username + " is not in the guild, or has joined recently.")
        }
    } else {
        msg.channel.send('Username invalid or not in the guild.')
    }
}

async function taxDueList(msg) {
    if (checkStaff == false) return;
    try {
        let memArray = await data.taxList(0);
        let empty = [""];
        let corrArray = empty.concat(memArray);
        let dueMembers = corrArray.join('\n');
        let length = corrArray.length - 1;
        let value;
        if (length == 0) {
            value = '```Yay! No one on the due list!```';
        } else {
            value = '```'+dueMembers+'```';
        }
        const dueMessage = new i.Discord.MessageEmbed()
            .setColor(v.hexcolor)
            .setAuthor(v.botname, v.botimg)
            .setTitle(`Members That Havn't Paid Next Week's Fee Yet`)
            .setDescription(`Make sure to pay before the deadline (11:59 PM PST)!`)
            .addFields(
                {name: "Members that haven't paid yet: `" + (length) +"`", value: value}
            )
            .setFooter('From Rajah, with <3', v.rajimg);
        msg.channel.send(dueMessage);
    } catch {
        log('taxDueList error: '+err);
    }
}

async function taxKickList(msg) {
    if(checkStaff == false) return;
    try {
        let memArray = await data.taxList(-1);
        let empty = [""];
        let corrArray = empty.concat(memArray);
        let kickMembers = corrArray.join('\n');
        let length = corrArray.length - 1;
        let value;
        if (length == 0) {
            value = '```Yay! No one on the kick list!```';
        } else {
            value = '```'+kickMembers+'```';
        }
        const kickMessage = new i.Discord.MessageEmbed()
            .setColor(v.hexcolor)
            .setAuthor(v.botname, v.botimg)
            .setTitle(`Members that didn't pay before the deadline`)
            .setDescription(`Make sure to double check the spreadsheet before kicking`)
            .addFields(
                {name: "Members that didn't pay: `" + (length) + "`", value: value}
            )
            .setFooter('From Rajah, with <3', v.rajimg);
        msg.channel.send(kickMessage);
    } catch {
        log('taxKickList error: '+err);
    }
}

async function acceptTax(msg, com, accept) { //accept / revoke
    let perms = await data.getvalue('users', 'acceptTax', msg.author.id)
    if (perms) {
        if (com.length > 1) {
            let id = com[1];
            if (accept == 'add') {
                data.writevalue('users', 'acceptTax', id, 'true');
                let username = await data.getvalue('users', 'username', id);
                msg.channel.send('Added accept tax permissions to ' + username + '.');
            } else if (accept == 'revoke') {
                data.writevalue('users', 'acceptTax', id, 'false');
                let username = await data.getvalue('users', 'username', id);
                msg.channel.send('Revoked accept tax permissions from ' + username + '.');
            }

        } else if (accept == 'add') {
            msg.channel.send('Please specify a discord ID (not username) to give accept tax permissions.')
        } else {
            msg.channel.send('Please specify a discord ID (not username) to revoke accept tax permissions from.')
        }
    } else if (accept == 'add') {
        msg.channel.send('Only staff that can accept taxes can add people to the accept tax list.')
    } else {
        msg.channel.send('Only staff that can accept taxes can revoke people from the accept tax list.')
    }
}

async function uses(msg, com) {
    let filter;
    if (com.length == 1) {
        filter = true;
    } else if (com[1] == 'true') {
        filter = true;
    } else {
        filter = false;
    }
    let onoff;
    if (filter) onoff = 'on'
    else onoff = 'off'
    let uses = await data.getBotUses(filter);
    msg.channel.send('**SHADOWRAGE Bot Usage**\nFilter: `' + onoff + '`\nUses recorded: `'+uses+'`');
}

async function compliment(msg) {
    function getRandomInt(max) {
        return Math.floor(Math.random() * Math.floor(max));
    }
    msg.reply(comp.compliment[getRandomInt(comp.compliment.length)])
    let amount = await data.getvalue('users', 'compliment', msg.author.id);
    amount = amount + 1;
    data.writevalue('users', 'compliment', msg.author.id, amount);
}

async function gexp(msg, com) {

    msg.channel.send('This command has been upgraded. Use `' + 'g xp' + '` instead.');
    return;

    let uuid;
    let username;
    let weeks = 0;
    if (com.length == 2 && parseInt(com[1]) == parseInt(com[1])) weeks = parseInt(com[1]);
    if (com.length > 1 && parseInt(com[1]) != parseInt(com[1])) { //finds UUID from input
        username = com[1];
        uuid = await data.taxGetValue('username', username, 'uuid');
        if (com.length > 2 && !isNaN(parseInt(com[2]))) {
            weeks = parseInt(com[2]);
        }
    } else {
        let values = await data.getvalue('users', ['uuid', 'ign'], msg.author.id);
        uuid = values[0];
        let memUsername
        try { memUsername = await data.taxGetValue('uuid', uuid, 'username') } catch(err) { msg.channel.send('Internal error.'); log(err); return; }
        if (values[1] != memUsername.toLowerCase()) {
            let id = await data.findvalue('users', 'uuid', uuid);
            if (id[0]) {
                data.writevalue('users', 'username', id[1], memUsername.toLowerCase());
            } else {
                log("gexp failed to update username in 'users' table: findvalue failed.")
            }
        }
        username = memUsername;
    }
    let xp;
    try {xp = await getGEXP(uuid)} catch(err) {
        if (err == 'Invalid username') {
            msg.channel.send('Invalid username.');
        } else {
            log(err);
        }
        return;
    };
    let curWeek = await data.getvalue('info', 'curWeek', 1);
    if (weeks != 0) {
        if (weeks < 0) {
            msg.channel.send('Invalid week number.');
            return;
        }
        let week = curWeek - (weeks*1000*60*60*24*7)
        let oldXP = await data.pastGEXP(uuid, week)
        msg.channel.send(`${username} had `+"`"+`${oldXP} XP`+"`"+` ${weeks} week(s) ago.`)
        return;
    }
    let leaderboard = await data.leaderboard('members', 'gexp', 'uuid', 100000, 0)
    let flatLeaderboard = leaderboard.flat()
    let place = Math.ceil(flatLeaderboard.indexOf(uuid) / 2);
    let perWeekComplete = (Date.now() - curWeek) / (1000*60*60*24*7); //finding percentage complete of the week
    let perGEXPComplete = xp / v.gexpReq;
    let passWeeks = await data.taxGetValue('uuid', uuid, 'passWeeks');
    if (passWeeks != 0) {
        const gexpMsg = new i.Discord.MessageEmbed()
            .setColor('#00FF00')
            .setAuthor(`✅ ${username} has a pass!`)
            .setTitle(`${passWeeks} pass week(s) left.`)
            .addFields(
                { name: `This week's GEXP so far`, value: `${xp} [${Math.round(100*(xp / v.gexpReq))}%]`},
                { name: `Projected weekly total`, value: `${Math.round(xp / perWeekComplete)} [${Math.round(100*(Math.round(xp / perWeekComplete) / v.gexpReq))}%]`},
                { name: `Placement in guild`, value: `${place} of ${leaderboard.length} [Top ${(Math.round(100*(place/leaderboard.length)))}%]`}
            )
            .setFooter(`Weekly GEXP Req: ${v.gexpReq}`)
        msg.channel.send(gexpMsg)
    } else if (xp >= v.gexpReq) { //over gexp req already
        const gexpMsg = new i.Discord.MessageEmbed()
            .setColor('#00FF00')
            .setAuthor(`✅ ${username} is all set!`)
            .setTitle(`Great dedication!`)
            .addFields(
                { name: `This week's GEXP so far`, value: `${xp} [${Math.round(100*(xp / v.gexpReq))}%]`},
                { name: `Projected weekly total`, value: `${Math.round(xp / perWeekComplete)} [${Math.round(100*(Math.round(xp / perWeekComplete) / v.gexpReq))}%]`},
                { name: `Placement in guild`, value: `${place} of ${leaderboard.length} [Top ${(Math.round(100*(place/leaderboard.length)))}%]`}
            )
            .setFooter(`Weekly GEXP Req: ${v.gexpReq}`)
        msg.channel.send(gexpMsg)
    } else {
        if (perGEXPComplete >= perWeekComplete) { //on track to complete by the end of the week
            const gexpMsg = new i.Discord.MessageEmbed()
                .setColor('#FFFF00')
                .setAuthor(`⚠️ ${username} is on track!`)
                .setTitle(`Keep playing!`)
                .addFields(
                    { name: `This week's GEXP so far`, value: `${xp} [${Math.round(100*(xp / v.gexpReq))}%]`},
                    { name: `Projected weekly total`, value: `${Math.round(xp / perWeekComplete)} [${Math.round(100*(Math.round(xp / perWeekComplete) / v.gexpReq))}%]`},
                    { name: `Placement in guild`, value: `${place} of ${leaderboard.length} [Top ${(Math.round(100*(place/leaderboard.length)))}%]`}
                )
                .setFooter(`Weekly GEXP Req: ${v.gexpReq}`)
            msg.channel.send(gexpMsg);
        } else { //not on track to complete.
            const gexpMsg = new i.Discord.MessageEmbed()
                .setColor('#FF0000')
                .setAuthor(`❌ ${username} isn't on track!`)
                .setTitle(`Play more!`)
                .addFields(
                    { name: `This week's GEXP so far`, value: `${xp} [${Math.round(100*(xp / v.gexpReq))}%]`},
                    { name: `Projected weekly total`, value: `${Math.round(xp / perWeekComplete)} [${Math.round(100*(Math.round(xp / perWeekComplete) / v.gexpReq))}%]`},
                    { name: `Placement in guild`, value: `${place} of ${leaderboard.length} [Top ${(Math.round(100*(place/leaderboard.length)))}%]`}
                )
                .setFooter(`Weekly GEXP Req: ${v.gexpReq}`)
            msg.channel.send(gexpMsg);
        }
    }
}

async function gexpLeaderboard(msg, com) {
    let num;
    let members;
    let totalBoard = false;
    switch (com.length) {
        case 1:
            num = v.defaultLeaderboardSize
            members = await data.leaderboard('members', 'gexp', 'username', num, 0)
            break;
        case 2:
            if (com[1] == 'total') {
                num = v.defaultLeaderboardSize;
                totalBoard = true;
                try { members = await totalGEXPLeaderboard(num) } catch(err) { msg.channel.send('Internal error.'); log(err); return; }
            } else if (/^\d+$/.test(com[1])) {
                num = parseInt(com[1])
                if (num > 200 || num <= 0) {
                    msg.channel.send('Invalid number.')
                    return;
                }
                members = await data.leaderboard('members', 'gexp', 'username', num, 0)
            } else {
                msg.channel.send('Invalid input.')
            }
            break;
        case 3:
            if (/^\d+$/.test(com[2])) {
                totalBoard = true;
                num = parseInt(com[2])
                if (num > 200 || num <= 0) {
                    msg.channel.send('Invalid number.')
                    return;
                } else {
                    try { members = await totalGEXPLeaderboard(num) } catch(err) { msg.channel.send('Internal error.'); log(err); return; }
                }
            } else {
                msg.channel.send('Invalid input');
            }
            break;
        default:
            msg.channel.send('Invalid input.')
            break;
    }
    if (members.length > 0) {
        let amount;
        if (members.length == num) {
            amount = num;
        } else {
            amount = 'Guild';
        }
        let title = 'Current GEXP Leaderboard';
        let min = v.gexpReq;
        if (totalBoard) title = 'Lifetime GEXP Leaderboard'; min = 0;
        leaderboardMessage(msg, members, title, `Top ${amount} Members`, 'Place  Username        Guild XP', min);
    } else {
        msg.channel.send('Internal error.');
        log('gexpLeaderboard error: member variable length 0. Query: '+msg.content);
    }
    return;
}

async function leaderboardMessage(msg, members, title, name, header, cut) {

    const chunkArray = (array, chunkSize) => {
        const numberOfChunks = Math.ceil(array.length / chunkSize)    
        return [...Array(numberOfChunks)]
            .map((value, index) => {
            return array.slice(index * chunkSize, (index + 1) * chunkSize)
        })
    }

    let output = [header];
    let cutOff = false;
    for (index in members) {
        let member = members[index];
        if (cut != 0) {
            if (member[0] >= cut) {
                let spacing = '';
                if (parseInt(index) + 1 <= 9) {
                    spacing = ' ';
                }
                let coloring;
                if (index % 2 == 0) {
                    coloring = '+'
                } else {
                    coloring = '-'
                }
                let name = i.sprintf('%-24s', `${coloring}  ${parseInt(index) + 1}${spacing}  ${member[1]}`);
                let finalMember = name.concat(member[0])
                output.push(finalMember);
            } else {
                cutOff = true;
            }
        } else {
            let spacing = '';
            if (parseInt(index) + 1 <= 9) {
                spacing = ' ';
            }
            let coloring;
            if (index % 2 == 0) {
                coloring = '+'
            } else {
                coloring = '-'
            }
            let name = i.sprintf('%-24s', `${coloring}  ${parseInt(index) + 1}${spacing}  ${member[1]}`);
            let finalMember = name.concat(member[0])
            output.push(finalMember);
        }
    }
    let size = v.leaderboardArraySize;
    if (cut != 0) {
        output.push(`Values less than ${cut} hidden.`)
        if (output.length == (v.leaderboardArraySize + 1)) {
            size++;
        }
    }

    let splitMembers = chunkArray(output, size);
    let fields = [];
    let endIndex = 0;
    for (index in splitMembers) {
        let input;
        if (index == 0) {
            input = {
                name: `${name}`,
                value: '```diff\n'+`${splitMembers[index].join('\n')}`+'```'
            }
        } else {
            let subtractValue = 1;
            if (splitMembers[index].length != v.leaderboardArraySize && cutOff == true) {
                subtractValue = 2;
            }
            input = {
                name: `${endIndex} - ${endIndex + splitMembers[index].length - subtractValue}`,
                value: '```diff\n'+`${splitMembers[index].join('\n')}`+'```'
            }
        }
        endIndex = endIndex + splitMembers[index].length;
        fields.push(input);
    }
    gexpMessage = new i.Discord.MessageEmbed()
        .setColor(v.hexcolor)
        .setTitle(title)
        .setAuthor(v.botname, v.botimg)
        .addFields(fields)
        .setFooter(v.rajsign, v.rajimg)
    msg.channel.send(gexpMessage);
}

async function currentUnderList(msg, com) {
    if (checkStaff(msg) == false) return;
    let limit, name;
    if (com.length <= 1) {
        limit = 200;
    } else {
        limit = parseInt(com[1])
    }
    let result = await data.underList(v.gexpReq, limit, false)
    if (limit == 200) name = `Total: ${result.length} Members`;
    else name = `Filtered to ${result.length} members`;
    leaderboardMessage(msg, result, `Members currently under GEXP Req`, name, 'Place  Username        Guild XP', 0);
}

async function currentPassList(msg, com) {
    if (checkStaff(msg) == false) return;
    let limit, name;
    if (com.length <= 1) {
        limit = 200;
    } else {
        limit = parseInt(com[1])
    }
    let result = await data.leaderboard('members', 'passWeeks', 'username', limit, 1)
    if (limit == 200) name = `Total: ${result.length} Members`;
    else name = `Filtered to ${result.length} members`;
    leaderboardMessage(msg, result, `Members with Pass Weeks`, name, 'Place  Username      Weeks', 1);
}

async function addPassWeeks(msg, com) {
    let userRoles = [];
    msg.member.roles.cache.forEach(role => {
        userRoles.push(role.id)
    });
    let userCanUse = false;
    for (role of v.taxAcceptRole) {
        if (userRoles.indexOf(role) >= 0) {
            userCanUse = true;
        }
    }
    if (!userCanUse) {
        msg.channel.send('Spreadsheet Assistants and Admins Only.');
        return;
    }
    if (v.staffchannels.indexOf(msg.channel.id) < 0) {
        msg.channel.send('Use in a staff channel.');
        return;
    }
    await tax.newMembers();
    //await data.updateMembers();
    let weeksAdded;
    let username = com[1];
    if (com.length == 2) {
        weeksAdded = 1;
    } else {
        weeksAdded = parseInt(com[2]);
    }
 
    //make sure to add staff only functionality!
    let weeksPaid = await data.taxGetValue('username', username, 'passWeeks')

    if (weeksPaid != 'invalid input') {
        let newWeeks = weeksPaid + weeksAdded;
        if (newWeeks < -1) newWeeks = -1;
        if (newWeeks != weeksPaid) {
            msg.channel.send('Added '+weeksAdded+' pass week(s) to '+username+'. They now have '+newWeeks+' pass week(s).')
            data.writevalue('members', 'passWeeks', username, newWeeks);
            let check = await data.taxGetValue('username', username, 'passWeeks')
            if (check == newWeeks) {
                log('Added '+weeksAdded+' pass week(s) to '+username+'. They now have '+newWeeks+' pass week(s).');
            } else {
                log('Internal error, please try again. If the problem persists, ping Rajah.');
            }
            /*if (newWeeks > 0 && weeksPaid <= 0) { // deals with the remind role, removes it if a payment has been recorded.
                let id = await data.findvalue('users', 'ign', username)
                await changeRole(msg.client, v.remindRole, id[1], 'remove')
            } else if (weeksPaid > 0 && newWeeks <= 0) {
                let id = await data.findvalue('users', 'ign', username)
                await changeRole(msg.client, v.remindRole, id[1], 'add')
            }*/
        } 
    } else {
        msg.channel.send('Username invalid. Check spelling, and if the member recently changed their name.'); 
    }
}

async function xpKickList(msg, com) {
    if (checkStaff(msg) == false) return;
    let req = v.gexpReq, curDate = await data.getvalue('info', 'curWeek', 1);
    let date = curDate - (1000 * 60 * 60 * 24 * 7)
    switch (com.length) {
        case 2:
            if (parseInt(com[1]) <= 52) {
                if (parseInt(com[1]) != 0) {
                    date = date - (1000 * 60 * 60 * 24 * 7 * (parseInt(com[1]) - 1));
                }
            } else {
                req = parseInt(com[1])
            }
            break;
        case 3:
            req = parseInt(com[1])
            if (parseInt(com[2]) != 0) {
                date = date - (1000 * 60 * 60 * 24 * 7 * (parseInt(com[2]) - 1));
            }
            break;
    }
    let list = await data.kickList(req, date)
    let filteredList = [];
    await data.updateMembers();
    for (index in list) {
        let entry = list[index];
        let username;
        try { username = await data.taxGetValue('uuid', entry[0], 'username'); } catch (err) { log(err); continue; }
        if (username != null) {
            let inGuild = await data.taxGetValue('uuid', entry[0], 'inGuild')
            if (inGuild = 'true') {
                filteredList.push([entry[1], username]);
            }
        }
    }
    if (filteredList.length == 0) {
        msg.channel.send('Error: No members in database with given arguments.')
        return;
    }
    let title = `Members Who Missed Deadline`, name = `Total: ${filteredList.length} Members`;
    if (req != v.gexpReq) {
        title = `Members Who Missed ${req} XP`
        name = `${filteredList.length} Members Under ${req} XP`
    }
    if (date != curDate) {
        title = `Members Who Missed Deadline`
        name = `Total: ${filteredList.length} Members, ${(curDate - date) / (1000*60*60*24*7)} week(s) ago.`
    }
    if (req != v.gexpReq && date != curDate) {
        title = `Members Who Missed ${req} XP`;
        name = `${filteredList.length} Members Under ${req} XP\n${(curDate - date) / (1000*60*60*24*7)} week(s) ago.`
    }
    leaderboardMessage(msg, filteredList, title, name, 'Place  Username        Guild XP', 0);
}

async function grabTierDays(msg, com) {
    let result;
    if (com.length == 1) {
        result = await data.getvalue('users', ['ign', 'guildjointime'], msg.author.id)
    } else {
        let id = await data.findvalue('users', 'ign', com[1])
        if (!id[0]) {
            msg.channel.send('Invalid username.')
            return
        }
        result = await data.getvalue('users', ['ign', 'guildjointime'], id[1])
    }
    let time = parseInt(result[1])
    let dif = Date.now() - time
    let months = dif / 2592000000; //big number is miliseconds in 30 days
    let nextMonth;
    if (months < 0.5) { //stone
        nextMonth = 0.5
    } else if (months >= 0.5 && months < 1) { //coal
        nextMonth = 1
    } else if (months >= 1 && months < 2) { //iron
        nextMonth = 2
    } else if (months >= 2 && months < 4) { //gold
        nextMonth = 4
    } else if (months >= 4 && months < 6) { //lapis
        nextMonth = 6
    } else if (months >= 6 && months < 8) { //redstone
        nextMonth = 8
    } else if (months >= 8 && months < 10) { //emerald
        nextMonth = 10
    } else if (months >= 10 && months < 12) { //diamond
        nextMonth = 12
    } else if (months >= 12) { //obsidian
        nextMonth = 69
    }
    if (nextMonth == 69) {
        msg.channel.send('Max rank, wow!')
        return;
    }
    let timeUntilRank = ((nextMonth * (1000 * 60 * 60 * 24 * 30)) - dif)
    let daysUntil = Math.floor(timeUntilRank / (1000 * 60 * 60 * 24))
    let hoursUntil = Math.floor((timeUntilRank - (daysUntil * 1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    if (daysUntil <= 0 && hoursUntil <= 0) {
        msg.channel.send(`${result[0]} will rankup in less than two hours!`)
    } else {
        msg.channel.send(`${result[0]}'s time until rankup: ${daysUntil} days, ${hoursUntil} hours.`)
    }
}

async function test(msg, com, client) {

    const adata = await hclient.getSkyblockAuctions();
    let miscdata = [];
    for (const d of adata.auctions) {
        // d.category == "misc" && d.bin == true && d.claimed == false && d.starting_bid >= 2500000 && d.starting_bid <= 4000000
        if (d.auctioneer == "4d4f069095d4469e94eb01e432dda288") {
            miscdata.push(d);
        }
    }
    console.log(miscdata);
    /*const testplayer = {
        mining_xp: 2000,
        mining: 20,
        foraging_xp: 2000,
        foraging: 20,
        enchanting_xp: 2000,
        enchanting: 20,
        farming_xp: 2000,
        farming: 20,
        combat_xp: 2000,
        combat: 20,
        fishing_xp: 2000,
        fishing: 20,
        alchemy_xp: 2000,
        alchemy: 20,
        taming_xp: 2000,
        taming: 20,

        revenant_xp: 3334,
        tarantula_xp: 3333,
        sven_xp: 3333,

        catacomb_xp: 2000,
        catacomb: 15,
        healer_xp: 2000,
        healer: 15,
        mage_xp: 1000,
        mage: 10,
        berserk_xp: 1000,
        berserk: 10,
        archer_xp: 1000,
        archer: 10,
        tank_xp: 1000,
        tank: 10
    }*/
    /*const playerprof = await hclient.getSkyblockProfileData("d49c0759eb874ea08fafa734a3ca9e76");
    console.log(playerprof);
    const player = playerprof.profile.members['4316657338a94da3a0dfb6da9f39c170'];*/

    //const hypixelDownChannel = await client.channels.fetch('708855543950999563');
    //const hypixelDownMessage = await hypixelDownChannel.messages.fetch('855552183071932426');
    //hypixelDownMessage.edit('**Hypixel is UP!** It was down ~111 hours')
    
}

// exported variables and functions
module.exports.errmsg = errmsg;
module.exports.calc_xp = calc_xp;
module.exports.calc_max_xp = calc_max_xp;
module.exports.log = log;
//module.exports.getSplashTime = getSplashTime;
//module.exports.getSplasher = getSplasher;
module.exports.getPST = getPST;
module.exports.uuidrecord = uuidrecord;
module.exports.verifyign = verifyign;
module.exports.reactions = reactions;
module.exports.getUsername = getUsername;
module.exports.getMemberUUIDs = getMemberUUIDs;
module.exports.checkStaff = checkStaff;
//module.exports.spreadsheetTaxes = spreadsheetTaxes;
module.exports.fishingXP = fishingXP;
module.exports.remindDiscordIDs = remindDiscordIDs;
module.exports.changeRole = changeRole;
module.exports.updateAllGEXP = updateAllGEXP;
module.exports.writePastGEXPWeeks = writePastGEXPWeeks;
//module.exports.gexpPastSpreadsheet = gexpPastSpreadsheet;
//module.exports.gexpSpreadsheet = gexpSpreadsheet;
module.exports.notGuildMemberGEXPRemove = notGuildMemberGEXPRemove;
module.exports.GEXPRole = GEXPRole;

// exported responses to queries
module.exports.help = help;
module.exports.helpinfo = helpinfo;
module.exports.profiles = profiles;
module.exports.mean = mean;
module.exports.stop = stop;
module.exports.verify = verify;
module.exports.slayerxp = slayerxp;
module.exports.guildxp = guildxp;
module.exports.love = love;
module.exports.movesplash = movesplash;
module.exports.fuckamount = fuckamount;
module.exports.ignmessage = ignmessage;
module.exports.usernameinput = usernameinput;
module.exports.say = say;
module.exports.inguildchecker = inguildchecker;
module.exports.tierrole = tierrole;
module.exports.addWeek = addWeek;
module.exports.getWeeks = getWeeks;
module.exports.taxDueList = taxDueList;
module.exports.taxKickList = taxKickList;
module.exports.acceptTax = acceptTax;
module.exports.uses = uses;
module.exports.compliment = compliment;
module.exports.gexp = gexp;
module.exports.gexpLeaderboard = gexpLeaderboard;
module.exports.currentUnderList = currentUnderList;
module.exports.currentPassList = currentPassList;
module.exports.addPassWeeks = addPassWeeks;
module.exports.xpKickList = xpKickList;
module.exports.test = test;
module.exports.grabTierDays = grabTierDays;