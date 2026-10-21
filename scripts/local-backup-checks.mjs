// Development-only checks: copy approved source, never .env/.data, and remove only this issued root.
import { cp, symlink, unlink, lstat, readdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import { APP_ROOT, TEST_ROOT, ownedDirectory, verifyOwned, cleanup, writePrivate, directory, inside } from './local-backup-files.mjs'
import { runChild, childEnvironment } from './local-backup-postgres.mjs'
const receipt=await ownedDirectory(TEST_ROOT,'checks')
const modules=path.join(receipt.path,'node_modules')
try {
  for(const entry of ['app','server','shared','public','nuxt.config.ts','package.json','tsconfig.json']) {
    if(await lstat(path.join(APP_ROOT,entry)).then(()=>true,e=>e.code==='ENOENT'?false:Promise.reject(e))) await cp(path.join(APP_ROOT,entry),path.join(receipt.path,entry),{recursive:true,errorOnExist:true,force:false})
  }
  await symlink(path.join(APP_ROOT,'node_modules'),modules,'junction')
  for(const [name,args] of [['typecheck',['typecheck','--checker','vue-tsc']],['build-vercel',['build','--preset','vercel']],['build-node',['build','--preset','node-server']]]) {
    await verifyOwned(receipt)
    const output=await runChild(process.execPath,[path.join(APP_ROOT,'node_modules/nuxt/bin/nuxt.mjs'),...args],{cwd:receipt.path,env:childEnvironment({NUXT_TELEMETRY_DISABLED:'1'}),max:16*1024**2,timeout:120000})
    await writePrivate(path.join(APP_ROOT,'.cache',`OPS001B-${name}-${path.basename(receipt.path)}.log`),output)
    console.log(`${name}: PASS`)
  }
}finally{
  await verifyOwned(receipt)
  const info=await lstat(modules).catch(e=>e.code==='ENOENT'?null:Promise.reject(e))
  if(info){if(!info.isSymbolicLink())throw new Error('Unexpected check dependency path.');await unlink(modules)}
  // Nitro creates links inside its own generated output. Remove just these links,
  // never their targets, while the original in-process ownership receipt is live.
  async function removeBuildLinks(dir) {
    await directory(dir)
    for(const name of await readdir(dir)) {
      const child=path.join(dir,name),info=await lstat(child)
      if(info.isSymbolicLink()) {
        const relative=path.relative(receipt.path,child)
        if(!['.output'+path.sep,'.vercel'+path.sep].some(prefix=>relative.startsWith(prefix)) || !inside(receipt.path,await realpath(child))) throw new Error('Unexpected generated build link; preserving check root.')
        await verifyOwned(receipt)
        const current=await lstat(child)
        if(current.dev!==info.dev||current.ino!==info.ino||!current.isSymbolicLink())throw new Error('Generated build link identity changed.')
        await unlink(child)
      }else if(info.isDirectory())await removeBuildLinks(child)
    }
  }
  await removeBuildLinks(receipt.path)
  await cleanup(receipt)
}
