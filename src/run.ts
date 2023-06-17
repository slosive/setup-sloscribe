/*
MIT License

Copyright (c) 2023 Oluwole Fadeyi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
import * as os from 'os'
import * as path from 'path'
import * as util from 'util'
import * as fs from 'fs'

import * as toolCache from '@actions/tool-cache'
import * as core from '@actions/core'

const slotalkToolName = 'slotalk'

export async function run() {
   let version = core.getInput('version', {required: true})

   if (version !== 'latest' && version[0] !== "v") {
      version = getValidVersion(version)
   }

   core.startGroup(`Downloading slotalk ${version}`)
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
         return getURL("linux", "arm64", version)
      case operatingSystem == LINUX:
         return getURL("linux", "amd64", version)
      case operatingSystem == MAC_OS && arch == ARM64:
         return getURL("darwin", "arm64", version)
      case operatingSystem == MAC_OS:
         return getURL("darwin", "amd64", version)
      default:
         core.warning(
             `the installer was not able to find a valid slotalk binary for the host github runner os/arch: ${os}/${arch}`
         )
         return ''
   }
}

export function getURL(os: string, arch:string, version: string): string {
   if (version === "latest") {
      return util.format(
          'https://github.com/tfadeyi/slotalk/releases/latest/download/slotalk-%s-%s.tar.gz',
          os, arch
      )
   }
   return util.format(
       'https://github.com/tfadeyi/slotalk/releases/download/%s/slotalk-%s-%s.tar.gz',
       version, os, arch
   )
}

export async function downloadSlotalk(version: string): Promise<string> {
   let cachedToolpath = toolCache.find(slotalkToolName, version)
   if (!cachedToolpath) {
      let slotalkDownloadPath
      let downloadURL: string = getSlotalkDownloadURL(version)
      try {
         slotalkDownloadPath = await toolCache.downloadTool(downloadURL)
      } catch (exception) {
         throw new Error(
            `Failed to download slotalk from location ${downloadURL}`
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
   fileList: string[],
   fileToFind: string
) {
   const files = fs.readdirSync(dir)
   fileList = fileList || []
   files.forEach(function (file) {
      if (fs.statSync(path.join(dir, file)).isDirectory()) {
         fileList = walkSync(path.join(dir, file), fileList, fileToFind)
      } else {
         core.debug(file)
         if (file == fileToFind) {
            fileList.push(path.join(dir, file))
         }
      }
   })
   return fileList
}

run().catch(core.setFailed)
