const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const out=path.resolve(__dirname,'../test-results');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:false,args:['--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext({viewport:{width:1500,height:980}});const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
 await page.goto('http://127.0.0.1:4317');await page.waitForSelector('.chapter-link');
 await page.locator('.global-playback').click();
 const playback=await page.evaluate(fs.readFileSync(path.join(__dirname,'playback.js'),'utf8'));
 await page.waitForTimeout(400);await page.screenshot({path:path.join(out,'web-desktop.png')});
 const mobile=await context.newPage();await mobile.setViewportSize({width:390,height:844});await mobile.goto('http://127.0.0.1:4317');await mobile.waitForSelector('.global-playback');
 const mobileFits=await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
 if(!mobileFits)throw Error('Mobile outer-page horizontal overflow');
 await mobile.screenshot({path:path.join(out,'web-mobile.png')});
 if(errors.length)throw Error(errors.join('\n'));
 fs.writeFileSync(path.join(out,'web-results.json'),JSON.stringify({ok:true,playback,mobileFits,errors},null,2));
 await page.bringToFront();console.log('WEB_TEST_OK; browser tabs retained for review.');
 }catch(e){fs.writeFileSync(path.join(out,'web-results.json'),JSON.stringify({ok:false,error:String(e),errors},null,2));await page.screenshot({path:path.join(out,'web-error.png')});console.error(e);}
 // Keep the review browser and both tabs open until the user closes them.
})();
