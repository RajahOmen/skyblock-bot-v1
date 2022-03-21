const i = require('./modules/index.js');
const v = require(`./config.json`);
const data = require('./modules/database.js');
const tax = require('./modules/taxfunctions.js');
const r = require('./modules/responses.js');
const creds = require('./creds.json')

const client = new i.Discord.Client();

process.setMaxListeners(15)

// const hclient = new i.HypixelAPI('eda2b055-3190-46f4-8e56-bf1c1de4535c');
// ^ shouldn't be needed, use hypixel and mojang api in responses.js

async function hourly() {
	r.log("Hourly function called.");
	await r.inguildchecker();
	const guild = client.guilds.cache.get(v.discordguildid);
	let members = guild.members.cache.values();
	let list = [];
	//console.log(members);
	for (entry of members) {
		//console.dir(entry);
		list.push(entry.user);
	}
	for (user in list) {
		data.adduser(list[user]);
	}
	setTimeout(hourly, 3600000);
}

client.once('ready', () => {
	client.user.setActivity(`${v.pref}help`, {type:"LISTENING"});
	r.log('Ready!');
	hourly();
	try {
		r.changeRole(client, '826698213414928387', '594301273281396778', 'add');
	} catch {};
	setInterval(async function(){ //function that runs every 60s
		let date = new Date;
		data.getvalue('info', 'curWeek', 1).then(async oldTime => {  //tax week funcctions
			let diff = Date.now() - oldTime; //difference in seconds.
			/*data.getvalue('info', 'roleAdd', 1).then(async check => {
				if (check == 'false') {	//not done yet for this week
					data.writevalue('info', 'roleAdd', 1, 'true'); //set as true to prevent another try
					let IDs = await r.remindDiscordIDs();
					for (entry in IDs) {
						let id = IDs[entry]
						await r.changeRole(client, v.remindRole, id, 'add');
					}
				}
			})*/
			if (diff > 604800000) { //end of week stuff
				let newTime = oldTime + 604800000;
				await r.writePastGEXPWeeks(oldTime);
				//await r.gexpPastSpreadsheet(oldTime);
				await r.updateAllGEXP();
				await r.notGuildMemberGEXPRemove();
				data.subtractGEXPPassWeek();
				data.writevalue('info', 'curWeek', 1, newTime);
				/*data.writevalue('info', 'roleAdd', 1, 'false');
				data.subtractWeek();
				r.spreadsheetTaxes();*/
			}
		})
		let mins = date.getMinutes()
		if (mins == 30) { // Real hourly check.
			await tax.newMembers(); //finds new members for members table
			await data.updateMembers(); //updates members table with inGuild = true or false
			const res = await data.findvalues('members', 'inGuild', 'true');
			
			const gchannel = await client.channels.fetch('823228346103496704');
			const dchannel = await client.channels.fetch('823410866790858772');
			const dmems = await dchannel.guild.members.fetch();
			await gchannel.edit({ name: `Guild Members: ${res.length}/125` });
			await dchannel.edit({ name: `Discord Members: ${dmems.size}` });
			await tax.updateUsernames(); //updates members table with up to date usernames
			try { let response = await r.updateAllGEXP(); r.log(response); }  // updates gexp in member table. wont if theres an error in the weekly past gexp write function
			catch (err) { r.log(err) };
			/*try {
				await r.gexpSpreadsheet();
			} catch(err) {
				r.log(err)
			}*/

			data.getvalue('info', 'fishing', 1).then(async oldXP => { //theoof fishing
				let newXP = await r.fishingXP();
				let dif = newXP - oldXP
				if (dif > 10) {
					data.writevalue('info', 'fishing', 1, newXP);
					client.channels.cache.get('708187627035295774').send('<@'+v.rajid+'> Theoof89 did some fishing! Good for him! He gained '+dif+' last I checked!');
				}
			})

			const guild = client.guilds.cache.get(v.discordguildid);
			await r.tierrole(guild);
			/*tax.updateUsernames();
			tax.newMembers();*
			/*r.spreadsheetTaxes();*/
		}
		/*let PST = r.getPST();
		data.getvalue('info', ['pstday', 'psthour'], 1).then(time => { //updates pstday and psthour in the database.
			if(time[0] != PST[0]) {
				data.writevalue('info', 'pstday', 1, PST[0]);
				r.log('Database day updated.');
			}
			if(time[1] != PST[1]) {
				data.writevalue('info', 'psthour', 1, PST[1]);
				r.log('Database hour updated.');
			}
		})
		.catch(err => {
			r.log('updatetime error: '+err);
		})

		if(firstrun == true) { 			//smart update of timeuntil in database. Uses subtraction when not close to jump (to next splash), then uses api check.
			firstrun = false;		//first IF => updates timeuntil, so restarts won't cause issues.
			r.getSplashTime('', false).then(timeuntil => {
				data.writevalue('info', 'timeuntil', 1, timeuntil[0]);
				apitimevalue = timeuntil[0];
			});
		} else {		//else checks for rest of time (when not the first run)
			data.getvalue('info', 'timeuntil', 1).then(timeuntil => {
				if (timeuntil <= 0) {		//checks when splash is happening then, when timeuntil = 0 or is less (if a bug)
					r.getSplashTime('', false).then(timtil => {
						apitimevalue = timtil[0];
						data.writevalue('info', 'timeuntil', 1, timtil[0]);
					});
				} else if ((Math.abs(apitimevalue-timeuntil)) >= 60) {		//checks at max every hour, in case of any error propagation in long runs.
					r.getSplashTime('', false).then(timtil => {
						apitimevalue = timtil[0];
						data.writevalue('info', 'timeuntil', 1, timtil[0]);
					});
				} else {	//uses subtraction every other time.
					let newtime = parseInt(timeuntil) - 1;
					data.writevalue('info', 'timeuntil', 1, newtime);
				}
			}).catch(err => {  //catches and logs errors.
				r.log('Update timeuntil getvalue error: '+err);
			})
		}								
		data.getvalue('info', 'timeuntil', 1).then(timeuntil => {		//based on timeuntil in database.
			switch (timeuntil) {
				case 1:
					data.writevalue('info', 'splash', 1, 'unready');
					break;
				case 30:	// remind splasher.
					r.getSplashTime('', false).then(async splosher => {
						let readycheck = await data.getvalue('info', 'splash', 1)
						if (readycheck == 'ready') {
							r.log("30 Minute splash warning disabled.");
						} else {
							let splashers = await r.getSplasher(splosher[1]);
							if (splashers == 'error') {
								notif = await client.channels.cache.get('732112530151047240').send(v.gsplash_staff+" Spreadsheet API error, please check the spreadsheet for splasher information.\n✅ Can and will splash.\n❎ Cannot splash.\n<:splash:719397434027147265> Can but do not have potions.");
								await notif.react(`✅`);
								await notif.react(`❎`);
								await notif.react(client.emojis.cache.get(`719397434027147265`));
							} else {
								//r.log('30 minute splash warning delivered to: ');
								//console.dir(splashers);
								let notif;
								switch(splashers.length) {
									case 0: 
										let nosplasher = await client.channels.cache.get('732112530151047240').send(v.gsplash_staff+' **NO SPLASHER** signed up for the next splash! React to sign up to splash!');
										await nosplasher.react(`✅`);
										break;
									case 1:
										opensplashticket = true;
										notif = await client.channels.cache.get('732112530151047240').send('**React to this message** to confirm you will splash <@'+splashers[0]+'>!\n✅ Can and will splash.\n❎ Cannot splash.\n<:splash:719397434027147265> Can but do not have potions.');
										await notif.react(`✅`);
										await notif.react(`❎`);
										await notif.react(client.emojis.cache.get(`719397434027147265`));
										break;
									default:
										opensplashticket = true;
										let splasherList;
										splasherList = splashers.join('>, or <@');
										notif = await client.channels.cache.get('732112530151047240').send('**React to this message** to confirm one of you will splash <@'+splasherList+'>!\n✅ Can and will splash.\n❎ Cannot splash.\n<:splash:719397434027147265> Can but do not have potions.');
										await notif.react(`✅`);
										await notif.react(`❎`);
										await notif.react(client.emojis.cache.get(`719397434027147265`));
										break;
								}
							}
						}
					});
					break;
				case 15:	// remind splash staff if splasher hasn't responded.
					data.getvalue('info', 'splash', 1).then(splash => {
						if (splash == 'unready') {
							client.channels.cache.get('732112530151047240').send(v.gsplash_staff+' **HELP!** The assigned splasher has not confirmed they can splash!');
						}
						if (splash == 'potions') {
							client.channels.cache.get('732112530151047240').send(v.gsplash_staff+' **HELP!** We still need potions for the splash!');
						}
					})
					.catch(err => {
						r.log("9 minute check error: "+err)
					})
					break;
				default: break;
			}
		}).catch(err => {
			r.log("timeuntil switch statement (with reminders for splashers and members) error: "+err);
		})*/
	}, 60000); //Check every 60000 miliseconds (every minute)
});

/*client.on('messageReactionAdd', (react, user) => {
	data.getvalue('info', 'splash', 1).then(dbstate => {
		let splashready = dbstate
		r.reactions(react, user, splashready, apitimevalue)
	})
})*/

client.on('messageDelete', (msg) => {
	if (msg.channel.type == "text" && msg.channel.id !== '752587897277906966' && !msg.author.bot) {
		msg.guild.channels.cache.get('752587897277906966').send(`**Message by <@${msg.author.id}> in <#${msg.channel.id}> was deleted.\nMessage Content:**`);
		console.log(msg)
		msg.guild.channels.cache.get('752587897277906966').send('```\n' + msg.content + '\n```');
	}
})

client.on('messageReactionRemove', (react) => {
	if (react.emoji.toString == '<:owo:738277078193012748>' && react.author.id == v.botid)
		react.msg.react('<:owo:738277078193012748>')
})

client.on('guildMemberAdd', (member) => {
	data.adduser(member.user);
	r.log('Member joined discord. Put '+member.user.username+' through adduser function.');
	if (member.id === "285103027277529088") {
		member.setNickname('maddie is hot uwu owo :3');
		console.log('added spiky name');
	}
	if (member.id === "706292012118441996") {
		member.setNickname('maddie is so sexy uwu owo :3');
		console.log('added spiky alt name');
	}
})

client.on('messageUpdate', (msg, newMsg) => {
	if ((msg.author.id == "546148858569293824" || msg.author.id == "711722246380585030") && msg.content == v.theoofAttachMsg && newMsg.content != v.theoofAttachMsg && msg.attachments.size > 0) {
		log('theoof tried to edit his message, uh oh!')
		newMsg.delete();
	}
})

client.on('message', msg => {

	if (msg.author.id == "727259311511961600" && msg.content == "<@197429787684372481> First :D") { //nukebot stuff
		msg.channel.send('Second :D');
		return;
	}

	if (msg.author.username == v.botname) return;

	if (msg.author.id == 285103027277529088 && (msg.member.nickname == null || msg.member.nickname !== "maddie is hot owo uwu :3")) {
		console.log('changed spiky name on message')
		msg.member.setNickname('maddie is hot owo uwu :3');
	}

	// if (msg.channel.id === "788262538378084382" && !msg.content.toLowerCase().includes('skin') && !msg.member.roles.cache.has("708494656585072651")) {
	//	msg.channel.send("<@&788265541994807297> new update pog");wa 
	// }

	if (msg.content.toLowerCase().includes('gaming like')
		|| msg.content.toLowerCase().includes('are you <@&822187260170600518>')) {
		msg.reply('no');
		return;
	}

	if (msg.author.id == "546148858569293824" || msg.author.id == "711722246380585030") { //annoy theoof
		if(msg.attachments.size > 0 && msg.content != v.theoofAttachMsg) {
			msg.delete();
			//msg.react(client.emojis.cache.get(`738277078193012748`));
		}
		msg.react(client.emojis.cache.get(`734662596367482920`))
	}

	if (msg.author.id == "749132539523891261") {
		msg.react(client.emojis.cache.get('903486709587640321')).then(() => {
			msg.react(client.emojis.cache.get('903486694387507210'));
		});
	}

	let msglower = msg.content.toLowerCase();
	let weebcheck = msglower.replace(/[^a-z<0:3`]/g, '');

	data.adduser(msg.author);
	

	if (msglower == "bald") {			//bald
		msg.react(client.emojis.cache.get(`734662596367482920`));
	}

	let date = new Date;
	for (weebWord of v.weeblist) {
		if (weebcheck.includes(weebWord)) {
			if (msg.author.username == "Rajah" || msg.author.username == "speye") return;
			if (msg.author.id == '546148858569293824' || msg.author.id == '711722246380585030') {
				msg.channel.send("> "+msg.content+`\n- ${msg.author.username}, ${date.getFullYear()}`);
				msg.delete();
			} else {
				if (!msg.content.startsWith('<')) {
					msg.react(client.emojis.cache.get(`738277078193012748`));
				}
			}
		}
	}
	//if (v.weeblist.indexOf(weebcheck) > -1) {		//owo

	//}
	if (msg.author.id == '334346557379837963') {		//delete rock gif  // CARLETTE
		if (msg.attachments.size > 0 || msg.content.includes('https://')) {
			r.log("Deleted Carlette's message: " + msg.content);
			msg.delete()
		}
	}
	let fakecheck = msglower.replace(/[^a-z]/g, '');
	if (msg.author.id == '546148858569293824' || msg.author.id == '711722246380585030'/* || msg.author.id == v.rajid*/) {
		for (word of v.fakewords) {
			if (fakecheck.includes(word)) {
				msg.channel.send(`> Real\n- ${msg.author.username}, ${date.getFullYear()}`)
				msg.delete();
			}
		}
	}

	if (msglower.startsWith(`${v.pref}`) || msg.channel.type === 'dm') {
		let where;
		if (msg.channel.type === 'dm') {
			where = 'DMs'
		} else {
			where = msg.channel.name;
		}
		r.log(`${msg.author.username} in ${where}: ${msg.content}`)
	} else return;

	
	/*if (msg.author.id == '353171177826418699' && msglower.startsWith(`${v.pref}`)) {
		msg.reply('no.')
		return;
	}*/

	if (msg.channel.type == 'text') {
		if (v.commandChannelID.indexOf(msg.channel.id) < 0 && msg.author.id != v.rajid) {
			if (v.staffchannels.indexOf(msg.channel.id) >= 0) {
				msg.channel.send(`Use <#752587897277906966> or <#708187627035295774> for commands.`)
			} else {
				let staff = false;
				let userRoles = [];
				msg.member.roles.cache.forEach(role => userRoles.push(role.id));
				if (userRoles.indexOf(v.staffRole) >= 0) { staff = true }
				if (staff) {
					msg.channel.send(`Use <#752587897277906966> or <#708187627035295774> for commands.`)
				} else {
					msg.channel.send(`Use <#708187627035295774> for commands.`)
				}
			}
			return;	
		}
	}
	
	let withoutPref = msglower.slice(v.pref.length); // cuts out prefix
	let com = withoutPref.split(" "); // splits up msg as separated by spaces

	r.ignmessage(msg).then(haveign => {

		if (msg.channel.type == 'dm' && com[0] == 'username') {
			r.usernameinput(msg, com);
		} else {
			if (haveign == false) {
				msg.reply('Please see DMs for how to gain access to my commands.');
				let noignmsg = new i.Discord.MessageEmbed()
				.setColor(v.hexcolor)
				.setTitle('SHADOWRAGE')
				.setDescription("In order to use the bot's commands, you have to insert your username in Minecraft.")
				.addFields(
					{name: "Please respond to this message with format `sr username [your username]`", value: "Case sensitive. Ex. `sr username RajahOmen`"}
				)
				.setFooter(v.rajsign, v.rajimg);
			msg.author.send(noignmsg);
			}
		}

		if (haveign == false) return;

		if (msglower.startsWith(`${v.pref}`)) {
			data.addvalue(msg.author, "uses");
		}
		
		switch (com[0]) { // checks for specific command
			case "help":
				if (com.length > 1) {
					r.helpinfo(msg, com);
				} else r.help(msg);
				break;
			case "profiles":
				r.profiles(msg, com);
				break;
			case "guildxp":
				r.guildxp(msg, com);
				break;
			case "slayerxp":
				r.slayerxp(msg, com);
				break;
			case "stop":
				r.stop(msg);
				break;
			case "verify":
				r.verify(msg, com);
				break;
			case "fuck":
				r.mean(msg, com);
				data.addvalue(msg.author, "mean");
				break;
			case "love":
				r.love(msg);
				data.addvalue(msg.author, "love");
				break;
			/*case "splash":
				r.getSplashTime(msg, true);
				break;*/
			case "movesplash":
				r.movesplash(msg);
				break;
			case "fuckamount":
				r.fuckamount(msg);
				break;
			case "say":
				r.say(msg, com);
				break;
			case "roleupdate":
				if(msg.author != v.rajid) {
					msg.channel.send("Hey, you're not Rajah! Scram!");
					return;
				}
				msg.channel.send("Roles updated.");
				hourly();
				break;
			case "pay":
				r.addWeek(msg, com);
				break;
			case "tax":
				r.getWeeks(msg, com);
				break;
			case "xp":
				r.gexp(msg, com);
				break;
			case "xptop":
				r.gexpLeaderboard(msg, com);
				break;
			case "duelist":
				r.currentUnderList(msg, com);
				break;
			case "pass":
				r.addPassWeeks(msg, com);
				break;
			case "passlist":
				r.currentPassList(msg, com);
				break;
			case "kicklist":
				r.xpKickList(msg, com);
				break;
			case "uses":
				r.uses(msg, com);
				break;
			case "compliment":
				r.compliment(msg);
				break;
			case "rank":
				r.grabTierDays(msg, com);
				break;
			case "test":
				if (msg.author != v.rajid) return;
				r.test(msg, com, client);
				break;
			default:
				if (!(msg.channel.type === 'dm' && msg.author.id === v.rajid)) {
					msg.channel.send(r.errmsg);
				}
				break;
			/*case "duelist":
				r.taxDueList(msg);
				break;
			case "kicklist":
				r.taxKickList(msg);
				break;
			case "accepttax":
				r.acceptTax(msg, com, 'add');
				break;
			case "revoketax":
				r.acceptTax(msg, com, 'revoke');
				break;*/
		} 
	}).catch(err => {
		r.log('error in '+com[0]+' or haveign function: '+err);
	})
});


client.login(creds.discord);