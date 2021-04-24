/*
 * *******************************************************************************************
 * @author:  Oliver Kaufmann (Kyri123)
 * @copyright Copyright (c) 2021, Oliver Kaufmann
 * @license MIT License (LICENSE or https://github.com/Kyri123/KAdmin-ArkLIN2/blob/master/LICENSE)
 * Github: https://github.com/Kyri123/KAdmin-ArkLIN2
 * *******************************************************************************************
 */
"use strict"

const globalInfos           = require('./../global_infos')
const si                    = require('systeminformation')
const osu                   = require('node-os-utils')
const disk                  = require('check-disk-space')
const AA_util               = require('../util')
const server_state          = require('./server/state')
const serverCommands        = require('./server/commands')
const steamAPIhelper        = require('./../util_steam/steamAPI')
const updater               = require('./updater')
const cluster               = require('./cluster')
const ArkFiles              = require('../../../modifyed_packages/ark-files')


module.exports = {
    /**
     * Startet alle Intervalle
     */
    startAll: async () => {
        setInterval(() => module.exports.backgroundUpdater(),           CONFIG.main.interval.backgroundUpdater)
        setInterval(() => module.exports.doReReadConfig(),              CONFIG.main.interval.doReReadConfig)
        setInterval(() => module.exports.getTraffic(),                  CONFIG.main.interval.getTraffic)
        setInterval(() => module.exports.getStateFromServers(),         CONFIG.main.interval.getStateFromServers)
        setInterval(() => module.exports.doServerBackgrounder(),        CONFIG.main.interval.doServerBackgrounder)
        setInterval(() => module.exports.getDataFromSteamAPI(),         CONFIG.main.interval.getDataFromSteamAPI)
        setInterval(() => module.exports.doClusterStuff(),              CONFIG.main.interval.doClusterStuff)
        setInterval(() => module.exports.doSavegamesRead(),             CONFIG.main.interval.doSavegamesRead)

        module.exports.getDataFromSteamAPI()
        module.exports.getTraffic()
        module.exports.getStateFromServers()
        module.exports.doClusterStuff()
        module.exports.doServerBackgrounder()
        module.exports.doSavegamesRead()
    },

    /**
     * Arbeitet Clusteraufgaben (sync etc ab)
     */
    doClusterStuff: () => {
        if(debug) console.log('\x1b[33m%s\x1b[0m', `[${dateFormat(new Date(), "dd.mm.yyyy HH:MM:ss")}][DEBUG]\x1b[36m run > doClusterStuff`)
        cluster.startWork()
    },

    /**
     * Startet Intervall > getStateFromServers
     */
    getStateFromServers: () => {
        if(debug) console.log('\x1b[33m%s\x1b[0m', `[${dateFormat(new Date(), "dd.mm.yyyy HH:MM:ss")}][DEBUG]\x1b[36m run > getStateFromServers`)
        server_state.getStateFromServers()
    },

    /**
     * Liest die Konfigurationen neu ein
     * @returns {Promise<void>}
     */
    doReReadConfig: () => {
        (async () => {
            // Lade Konfigurationen
            let pathConfigDir    = pathMod.join(mainDir, '/app/config/')
            fs.readdirSync(pathConfigDir).forEach(item => {
                if(item.includes(".json")) {
                    try {
                        if(debug) console.log('\x1b[33m%s\x1b[0m', `[${dateFormat(new Date(), "dd.mm.yyyy HH:MM:ss")}][DEBUG]\x1b[36m Load: ${pathMod.join(pathConfigDir, item)}`)
                        CONFIG[item.replace(".json", "")]   = JSON.parse(fs.readFileSync(pathMod.join(pathConfigDir, item), 'utf8'))
                    }
                    catch (e) {
                        console.log('\x1b[33m%s\x1b[0m', `[${dateFormat(new Date(), "dd.mm.yyyy HH:MM:ss")}]\x1b[31m ${pathConfigDir + item} cannot Loaded`)
                        console.log('\x1b[33m%s\x1b[0m', `[${dateFormat(new Date(), "dd.mm.yyyy HH:MM:ss")}]\x1b[31m Exit KAdmin-ArkLIN2`)
                        process.exit(1)
                    }
                }
            })

            // Lade Sprachdatei(en)
            let pathLangDir    = pathMod.join(mainDir, '/lang/')
            fs.readdirSync(pathLangDir).forEach(item => {
                let langPath                            = pathMod.join(pathLangDir, item)
                let pathInfo                            = fs.statSync(langPath)
                if(LANG[item] === undefined) LANG[item] = {}
                if(pathInfo.isDirectory())
                    fs.readdirSync(langPath).forEach(file => {
                        if(file.includes(".json")) {
                            try {
                                if(debug) console.log('\x1b[33m%s\x1b[0m', `[${dateFormat(new Date(), "dd.mm.yyyy HH:MM:ss")}][DEBUG]\x1b[36m Load: ${langPath}/${file}`)
                                LANG[item][file.replace(".json", "")]   = JSON.parse(fs.readFileSync(pathMod.join(langPath, file), 'utf8'))
                            }
                            catch (e) {
                                console.log('\x1b[33m%s\x1b[0m', `[${dateFormat(new Date(), "dd.mm.yyyy HH:MM:ss")}]\x1b[31m Exit KAdmin-ArkLIN2`)
                                console.log('\x1b[33m%s\x1b[0m', `[${dateFormat(new Date(), "dd.mm.yyyy HH:MM:ss")}]\x1b[31m ${langPath}/${file} cannot Loaded`)
                                process.exit(1)
                            }
                        }
                    })
            })
        })()
    },

    /**
     * Prüft nach neuer Panel Version
     */
    backgroundUpdater: () => {
        updater.check()
    },

    /**
     * Startet Intervall > getDataFromSteamAPI
     */
    getDataFromSteamAPI: () => {
        (async function() {
            if(debug) console.log('\x1b[33m%s\x1b[0m', `[${dateFormat(new Date(), "dd.mm.yyyy HH:MM:ss")}][DEBUG]\x1b[36m run > getDataFromSteamAPI`)

            let serverList  = Object.entries(globalInfos.getServerList())
            let playerIds   = []
            let modIds      = []

            for(const server of serverList) {
                let serverData  = new serverClass(server[0])
                if(serverData.serverExsists()) {
                    let serverIni = serverData.getINI()
                    let serverInfos = server[1]

                    //lese ModID's
                    try {
                        let gameModIds = serverIni.ark_GameModIds
                        let totalConversionMod = (serverIni.totalConversionMod !== "" && !isNaN(serverIni.totalConversionMod)) && serverIni.totalConversionMod !== undefined
                           ? serverIni.totalConversionMod
                           : false
                        let serverMapModId = serverIni.serverMapModId !== "" && !isNaN(serverIni.serverMapModId) && serverIni.serverMapModId !== undefined
                           ? serverIni.serverMapModId
                           : false
                        let modArray = (gameModIds !== "" && !isNaN(gameModIds)) || gameModIds !== undefined
                           ? (serverIni.ark_GameModIds
                                 ? serverIni.ark_GameModIds.split(',')
                                 : []
                           ) : []

                        // füge Map hinzu
                        if (!modIds.includes(serverMapModId) && serverMapModId !== false)
                            modIds.push(serverMapModId)

                        // füge TotalMod hinzu wenn nicht Primitiv+
                        if (!modIds.includes(totalConversionMod) && totalConversionMod !== false && +totalConversionMod !== 111111111)
                            modIds.push(totalConversionMod)

                        for (const modId of modArray) {
                            if (!modIds.includes(modId) && !isNaN(+modId) && modId !== '') modIds.push(modId)
                        }
                    }
                    catch (e) {
                        if(debug) console.log('[DEBUG_FAILED]', e)
                    }


                    //Lese Spieler
                    let saveGameDirArray   = globalUtil.safeFileReadDirSync([serverData.getSaveDirLocation(false)])
                    if(saveGameDirArray !== false) {
                        for (const file of saveGameDirArray) {
                            if(file.FileExt === ".arkprofile")
                                if(!playerIds.includes(file.namePure)) playerIds.push(file.namePure)
                        }

                        // TODO: Wenn Features implementiert werden
                        // auslesen von Whitelist
                        // auslesen von Blacklist (Banlist)
                        // auslesen von Adminlist
                    }
                }
            }

            // erstelle modid.json
            if(Array.isArray(modIds))
                steamAPIhelper.getModList(modIds)

            // erstelle player.json
            if(Array.isArray(playerIds))
                steamAPIhelper.getPlayerList(playerIds)
        })()
    },

    /**
     * Startet Intervall > getStateFromServers
     */
    getTraffic: () => {
        (async () => {
            if(debug) console.log('\x1b[33m%s\x1b[0m', `[${dateFormat(new Date(), "dd.mm.yyyy HH:MM:ss")}][DEBUG]\x1b[36m run > getTraffic`)
            osu.cpu.usage().then (cpuPercentage => {
                let disk_path = pathMod.join(globalUtil.safeFileExsistsSync([CONFIG.app.servRoot]) ? CONFIG.app.servRoot : mainDir)
                disk(disk_path).then((info) => {
                    si.mem()
                       .then(mem => {
                           let ramPercentage = 100 - (mem.available / mem.total * 100)
                           let memPercentage = 100 - (info.free / info.size * 100)

                           let data = {
                               "cpu" : cpuPercentage.toFixed(2),
                               "ram" : ramPercentage.toFixed(2),
                               "ram_total" : AA_util.convertBytes(mem.total),
                               "ram_availble" : AA_util.convertBytes(mem.total - mem.available),
                               "mem" : memPercentage.toFixed(2),
                               "mem_total" : AA_util.convertBytes(info.size),
                               "mem_availble" : AA_util.convertBytes(info.size - info.free)
                           }

                           globalUtil.safeFileSaveSync([mainDir, '/public/json/serverInfos/', 'auslastung.json'], JSON.stringify(data))
                       })
                })
            })
        })()
    },


    /**
     * Lies Savegames der Server aus
     * @returns {Promise<void>}
     */
    doSavegamesRead: () => {
        (async () => {
            if(debug) console.log('\x1b[33m%s\x1b[0m', `[${dateFormat(new Date(), "dd.mm.yyyy HH:MM:ss")}][DEBUG]\x1b[36m run > doSavegamesRead`)
            let serverInfos     = globalInfos.get()

            if(serverInfos.servers_arr.length > 0) {
                serverInfos.servers_arr.forEach((val) => {
                    let serv = new serverClass(val[0])
                    if(serv.serverExsists()) {
                        let cfg = serv.getConfig()
                        let INI = serv.getINI()

                        // Lade Saves
                        if(serv.getSaveDirLocation() !== false) {
                            let saveDir     = serv.getSaveDirLocation(false)
                            if(globalUtil.safeFileExsistsSync([saveDir])) {
                                try {
                                    let savegames = new ArkFiles(saveDir)
                                    let saves       = savegames.getPlayers()
                                    for(const i in saves) {
                                        if(saves[i].Tribe) {
                                            if (saves[i].Tribe.Players) delete saves[i].Tribe.Players
                                            if (saves[i].Tribe.TribeLogs) delete saves[i].Tribe.TribeLogs
                                            if (saves[i].Tribe.TribeMemberNames) delete saves[i].Tribe.TribeMemberNames
                                        }
                                    }
                                    globalUtil.safeFileSaveSync([mainDir, "public/json/savegames/players/", `${serv.server}.json`], JSON.stringify(saves))
                                }
                                catch (e) {
                                    if(debug) console.log('[DEBUG_FAILED]', e)
                                }
                                try {
                                    let savegames   = new ArkFiles(saveDir)
                                    let saves       = savegames.getTribes()
                                    for(const i in saves) {
                                        if(saves[i].Players) delete saves[i].Players
                                        if(saves[i].TribeLogs) if(Array.isArray(saves[i].TribeLogs)) saves.TribeLogs = globalUtil.removeEmtpyElementsFromArray(saves[i].TribeLogs)
                                    }
                                    globalUtil.safeFileSaveSync([mainDir, "public/json/savegames/tibes/", `${serv.server}.json`], JSON.stringify(saves))
                                }
                                catch (e) {
                                    if(debug) console.log('[DEBUG_FAILED]', e)
                                }
                            }

                            // Lade Maps
                            let dirScan     = globalUtil.safeFileReadDirSync([saveDir])
                            let knownMaps = globalUtil.safeFileReadSync([mainDir, "public/json/sites", "maps.json"], true)
                            let mapFiles = []
                            if(dirScan !== false) {
                                for (const file of dirScan) {
                                    if (
                                       file.FileExt === ".ark"
                                       || file.name.includes("_AntiCorruptionBackup")
                                       || file.name.includes("_NewLaunchBackup")
                                    ) {
                                        file.iconOfMap = "/img/unknown.png"
                                        for (const map of Object.entries(knownMaps)) {
                                            if (file.namePure.includes(map[0])) {
                                                file.iconOfMap = `/img/maps/${map[0]}.jpg`
                                                break
                                            }
                                        }

                                        file.DownloadUrl = file.totalPath.replace(CONFIG.app.servRoot, "")

                                        mapFiles.push(file)
                                    }
                                }
                            }

                            globalUtil.safeFileSaveSync([mainDir, "public/json/savegames/maps/", `${serv.server}.json`], JSON.stringify(mapFiles))
                        }

                    }
                })
            }
        })()
    },


    /**
     * Führt hintergrund aktionen von Server aus Bsp.: Automatisches Update
     * @returns {Promise<void>}
     */
    doServerBackgrounder: () => {
        (async () => {
            if(debug) console.log('\x1b[33m%s\x1b[0m', `[${dateFormat(new Date(), "dd.mm.yyyy HH:MM:ss")}][DEBUG]\x1b[36m run > doServerBackgrounder`)
            let serverInfos     = globalInfos.get()

            if(serverInfos.servers_arr.length > 0) {
                serverInfos.servers_arr.forEach((val) => {
                    let serv = new serverClass(val[0])
                    if(serv.serverExsists()) {
                        let cfg = serv.getConfig()
                        let INI = serv.getINI()
                        // Auto Backup system
                        if(cfg.autoBackup) {
                            if(!cfg.autoBackupNext) cfg.autoBackupNext = 0
                            if(Date.now() > cfg.autoBackupNext) {
                                serverCommands.doBackup(val[0], cfg.autoBackupPara);
                                serv.writeConfig("autoBackupNext", (Date.now() + +cfg.autoBackupInterval))
                                if(debug) console.log('\x1b[33m%s\x1b[0m', `[${dateFormat(new Date(), "dd.mm.yyyy HH:MM:ss")}][DEBUG]\x1b[36m run > doServerBackgrounder > autoBackup > ${val[0]}`)
                            }
                        }

                        // Auto Update system
                        if(cfg.autoUpdate) {
                            if(!cfg.autoUpdateNext) cfg.autoUpdateNext = 0
                            if(Date.now() > cfg.autoUpdateNext) {
                                serverCommands.doArkmanagerCommand(val[0], "update", cfg.autoUpdatePara);
                                serv.writeConfig("autoUpdateNext", (Date.now() + +cfg.autoUpdateInterval))
                                if(debug) console.log('\x1b[33m%s\x1b[0m', `[${dateFormat(new Date(), "dd.mm.yyyy HH:MM:ss")}][DEBUG]\x1b[36m run > doServerBackgrounder > autoUpdate > ${val[0]}`)
                            }
                        }

                        // soll der Server laufen?
                        // Übernimmt Arkmanager
                        /*if(cfg.shouldRun && val[1].pid === 0) {
                            if(debug) console.log('\x1b[33m%s\x1b[0m', `[${dateFormat(new Date(), "dd.mm.yyyy HH:MM:ss")}][DEBUG]\x1b[36m run > doServerBackgrounder > Start > ${val[0]}`)
                            serverCommands.doStart(val[0], [])
                        }*/
                    }
                })
            }
        })()
    }
}
