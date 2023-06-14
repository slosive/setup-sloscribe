// Copyright (c) Microsoft Corporation.
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as os from 'os'
import * as path from 'path'
import * as util from 'util'
import * as fs from 'fs'

import * as toolCache from '@actions/tool-cache'
import * as core from '@actions/core'

const slotalkToolName = 'slotalk'

export async function run() {
   let version = core.getInput('version', {required: true})

   if (version !== 'latest' && version[0] !== 'v') {
      version = getValidVersion(version)
   } else {
      version = 'latest'
      core.info('Getting latest Slotalk version')
   }

   core.startGroup(`Downloading ${version}`)
   const cachedPath = await downloadSlotalk(version)
   core.endGroup()

   try {
      if (!process.env['PATH']?.startsWith(path.dirname(cachedPath))) {
         core.addPath(path.dirname(cachedPath))
      }
   } catch {
      //do nothing, set as output variable
   }

   core.info(
      `Slotalk tool version '${version}' has been cached at ${cachedPath}`
   )
   core.setOutput('slotalk-path', cachedPath)
}

// Prefixes version with v
export function getValidVersion(version: string): string {
   return 'v' + version
}

const LINUX = 'Linux'
const MAC_OS = 'Darwin'
const ARM64 = 'arm64'
export function getSlotalkDownloadURL(version: string): string {
   const arch = os.arch()
   const operatingSystem = os.type()

   switch (true) {
      case operatingSystem == LINUX && arch == ARM64:
         return util.format(
            'https://github.com/tfadeyi/slotalk/releases/%s/download/slotalk-linux-arm64.tar.gz',
            version
         )
      case operatingSystem == LINUX:
         return util.format(
            'https://github.com/tfadeyi/slotalk/releases/%s/download/slotalk-linux-amd64.tar.gz',
            version
         )

      case operatingSystem == MAC_OS && arch == ARM64:
         return util.format(
            'https://github.com/tfadeyi/slotalk/releases/%s/download/slotalk-darwin-arm64.tar.gz',
            version
         )
      case operatingSystem == MAC_OS:
         return util.format(
            'https://github.com/tfadeyi/slotalk/releases/%s/download/slotalk-darwin-amd64.tar.gz',
            version
         )
      default:
         return ''
   }
}

export async function downloadSlotalk(version: string): Promise<string> {
   let cachedToolpath = toolCache.find(slotalkToolName, version)
   if (!cachedToolpath) {
      let slotalkDownloadPath
      try {
         slotalkDownloadPath = await toolCache.downloadTool(
            getSlotalkDownloadURL(version)
         )
      } catch (exception) {
         throw new Error(
            `Failed to download Slotalk from location ${getSlotalkDownloadURL(
               version
            )}`
         )
      }

      fs.chmodSync(slotalkDownloadPath, '777')
      const untarSlotalkPath = await toolCache.extractTar(slotalkDownloadPath)
      cachedToolpath = await toolCache.cacheDir(
         untarSlotalkPath,
         slotalkToolName,
         version
      )
   }

   const slotalkPath = findSlotalk(cachedToolpath)
   if (!slotalkPath) {
      throw new Error(
         util.format('Slotalk executable not found in path', cachedToolpath)
      )
   }

   fs.chmodSync(slotalkPath, '777')
   return slotalkPath
}

export function findSlotalk(rootFolder: string): string {
   fs.chmodSync(rootFolder, '777')
   let filelist: string[] = []
   walkSync(rootFolder, filelist, slotalkToolName)
   if (!filelist || filelist.length == 0) {
      throw new Error(
         util.format('Slotalk executable not found in path', rootFolder)
      )
   } else {
      return filelist[0]
   }
}

export var walkSync = function (
   dir: string,
   filelist: string[],
   fileToFind: string
) {
   const files = fs.readdirSync(dir)
   filelist = filelist || []
   files.forEach(function (file) {
      if (fs.statSync(path.join(dir, file)).isDirectory()) {
         filelist = walkSync(path.join(dir, file), filelist, fileToFind)
      } else {
         core.debug(file)
         if (file == fileToFind) {
            filelist.push(path.join(dir, file))
         }
      }
   })
   return filelist
}

run().catch(core.setFailed)
