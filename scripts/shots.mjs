import { chromium, devices } from 'playwright'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp'}
const root=join(process.cwd(),'dist')
const server=createServer(async(req,res)=>{try{let p=join(root,decodeURIComponent(req.url.split('?')[0]));if((await stat(p)).isDirectory())p=join(p,'index.html');res.writeHead(200,{'content-type':MIME[extname(p)]||'application/octet-stream'});res.end(await readFile(p))}catch{res.writeHead(404);res.end()}})
await new Promise(r=>server.listen(4190,r))
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'})
const page=await (await b.newContext({...devices['iPhone 12']})).newPage()
await page.goto('http://localhost:4190/'); await page.waitForSelector('.navbar')

// section sheet
await page.locator('.list .item').nth(4).click()
await page.waitForSelector('.sheet'); await page.waitForTimeout(400)
await page.screenshot({ path: '/tmp/shots/s1-sheet.png' })
await page.evaluate(()=>document.querySelector('.sheet .btn.text').click()); await page.waitForTimeout(300)

// tests tab (viewport shot)
await page.locator('.nav-item').nth(1).click(); await page.waitForSelector('.card.pri'); await page.waitForTimeout(300)
await page.screenshot({ path: '/tmp/shots/s2-tests.png' })

// exam with the numbered badges
await page.locator('.card.pri .btn').click(); await page.waitForSelector('.badgestrip')
for (let i=0;i<5;i++){ await page.locator('.qbadge').nth(i).click(); await page.waitForTimeout(60); await page.locator('.opt').first().click(); await page.waitForTimeout(60) }
await page.locator('.qbadge').nth(5).click(); await page.waitForTimeout(300)
await page.screenshot({ path: '/tmp/shots/s3-exam.png' })
await b.close(); server.close()
