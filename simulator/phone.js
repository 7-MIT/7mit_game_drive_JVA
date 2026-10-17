import {createPhoneHome, HOME_CSS} from './phone-home.js';
import {createPhoneStore, STORE_CSS} from './phone-store.js';
// ================================================================
// HANDPHONE: the player's phone, a full GUI with animated screens and apps.
// Lock screen → home screen (app grid + dock) → apps that open from their icon and close back into it.
// Apps: Ojek (ride / order food / drive ojol), Blue (taxi / send a parcel / drive a taxi or truck), Kendaraan,
// Peta, Dompet, Telepon, Pesan, Musik, Kamera, Galeri, Cuaca, Pengaturan. Case, wallpaper, theme and icons are customisable.
// The game hands in everything the apps need through `A` (see initPhone in main.js).
// ================================================================

const CSS = `
#phone{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:118px;z-index:7;width:300px;height:620px;transform-origin:100% 100%;
  transform:translateY(calc(100% + 160px)) rotate(6deg) scale(var(--ps,1));transition:transform .55s cubic-bezier(.2,1.25,.35,1),opacity .3s;opacity:0;pointer-events:none;font-family:Archivo,system-ui,sans-serif;-webkit-user-select:none;user-select:none}
#phone.on{transform:translateY(0) rotate(0) scale(var(--ps,1));opacity:1;pointer-events:auto}
#phone .case{position:absolute;inset:0;border-radius:46px;background:var(--case,#1b1c1f);padding:10px;box-shadow:0 30px 60px rgba(0,0,0,.45),inset 0 0 0 2px rgba(255,255,255,.14),inset 0 2px 6px rgba(255,255,255,.25)}
#phone .case::after{content:'';position:absolute;inset:0;border-radius:46px;background:linear-gradient(115deg,rgba(255,255,255,.22),transparent 32%,transparent 70%,rgba(255,255,255,.08));pointer-events:none}
#phone .hb{position:absolute;background:var(--case,#1b1c1f);filter:brightness(.8);border-radius:3px;width:4px}
#phone .hb.pw{right:-3px;top:150px;height:70px} #phone .hb.v1{left:-3px;top:130px;height:46px} #phone .hb.v2{left:-3px;top:186px;height:46px}
#phone .scr{position:relative;width:100%;height:100%;border-radius:37px;overflow:hidden;background:#000;color:var(--ink);--ink:#fff;--card:rgba(255,255,255,.14);--card2:rgba(255,255,255,.22);--sub:rgba(255,255,255,.7);--sheet:rgba(24,24,28,.86);--abg:#101114}
#phone.light .scr{--ink:#16171a;--card:rgba(255,255,255,.75);--card2:#fff;--sub:rgba(20,20,25,.62);--sheet:rgba(246,246,248,.94);--abg:#f2f2f6}
#phone .wall{position:absolute;inset:-20px;background:var(--wall);background-size:cover;background-position:center;transition:transform .5s cubic-bezier(.2,.9,.3,1),filter .5s}
#phone.app-open .wall{transform:scale(1.12);filter:blur(10px) brightness(.8)}
#phone .stat{position:absolute;left:0;right:0;top:0;height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 26px 0 30px;font-size:13px;font-weight:700;z-index:9;color:var(--ink);pointer-events:none}
#phone.app-open .stat{color:var(--ink);background:linear-gradient(var(--abg) 78%,transparent)}
#phone .stat .r{display:flex;gap:5px;align-items:center} #phone .stat svg{width:15px;height:15px}
#phone .isl{position:absolute;left:50%;top:9px;width:92px;height:26px;margin-left:-46px;border-radius:20px;background:#000;z-index:10;transition:width .45s cubic-bezier(.2,1.3,.3,1),margin .45s cubic-bezier(.2,1.3,.3,1),height .45s;display:flex;align-items:center;justify-content:center;gap:6px;overflow:hidden;color:#fff;font-size:11px;font-weight:700;white-space:nowrap}
#phone .isl.big{width:236px;margin-left:-118px;height:34px}
#phone .isl .dot{width:8px;height:8px;border-radius:50%;background:#2fdc6a;box-shadow:0 0 8px #2fdc6a}
/* lock screen */
#phone .lock{position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;align-items:center;padding-top:74px;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.35);transition:transform .5s cubic-bezier(.3,.9,.3,1),opacity .4s;cursor:grab;touch-action:none}
#phone .lock .d{font-size:15px;font-weight:600;opacity:.9} #phone .lock .t{font-size:78px;font-weight:300;letter-spacing:-2px;line-height:1.05;font-variant-numeric:tabular-nums}
#phone .lock .o{margin-top:6px;font-size:12px;opacity:.8} #phone .lock .nl{margin-top:22px;width:250px;display:grid;gap:6px}
#phone .lock .nl div{background:rgba(255,255,255,.2);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-radius:16px;padding:9px 12px;font-size:11.5px;text-shadow:none;animation:phIn .4s both}
#phone .lock .sw{position:absolute;bottom:34px;font-size:12px;font-weight:600;opacity:.85;animation:phBob 1.6s ease-in-out infinite}
#phone .lock.gone{transform:translateY(-105%);opacity:0;pointer-events:none}
#phone .lock:not(.gone) ~ .home{opacity:0;pointer-events:none;transform:scale(1.06)}
#phone .lock::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.25),transparent 40%,rgba(0,0,0,.3));z-index:-1}
@keyframes phBob{50%{transform:translateY(-6px)}}
/* home */
#phone .home{position:absolute;inset:0;padding:58px 16px 0;z-index:2;transition:transform .45s cubic-bezier(.2,.9,.3,1),opacity .3s}
#phone.app-open .home{transform:scale(.9);opacity:0;pointer-events:none}
#phone .wid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
#phone .wid > div{background:var(--card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-radius:20px;padding:10px 12px;min-height:66px;color:var(--ink)}
#phone .wid b{display:block;font-size:20px;font-weight:800;font-variant-numeric:tabular-nums} #phone .wid small{font-size:10.5px;color:var(--sub);font-weight:600}
#phone .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px 8px}
#phone .ic{display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;background:none;border:0;padding:0;color:var(--ink);font:inherit;position:relative}
#phone .ic i{width:54px;height:54px;border-radius:var(--rad,15px);display:grid;place-items:center;background:var(--g);box-shadow:0 6px 14px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.35);transition:transform .18s cubic-bezier(.3,1.6,.5,1)}
#phone .ic i svg{width:27px;height:27px;stroke:#fff;filter:drop-shadow(0 1px 1px rgba(0,0,0,.25))}
#phone .ic:active i{transform:scale(.86)} #phone .ic span{font-size:10.5px;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,.4);white-space:nowrap}
#phone.light .ic span{text-shadow:none}
#phone .ic .bd{position:absolute;right:2px;top:-4px;min-width:18px;height:18px;border-radius:9px;background:#ff3b30;color:#fff;font-size:10.5px;font-weight:800;display:grid;place-items:center;padding:0 4px;animation:phPop .35s cubic-bezier(.3,1.8,.5,1)}
@keyframes phPop{from{transform:scale(0)}}
#phone .home.in .ic{animation:phIn .45s cubic-bezier(.2,1.2,.3,1) both}
@keyframes phIn{from{opacity:0;transform:translateY(16px) scale(.85)}}
#phone .dock{position:absolute;left:12px;right:12px;bottom:22px;height:80px;border-radius:30px;background:var(--card);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);display:grid;grid-template-columns:repeat(4,1fr);align-items:center;padding:0 6px}
#phone .dock .ic span{display:none}
/* apps */
#phone .app{position:absolute;inset:0;z-index:5;background:var(--abg,#101114);border-radius:37px;overflow:hidden;transform-origin:var(--ox,50%) var(--oy,50%);transform:scale(.12);opacity:0;pointer-events:none;transition:transform .42s cubic-bezier(.2,1,.3,1),opacity .25s,border-radius .42s}
#phone .app.on{transform:scale(1);opacity:1;pointer-events:auto}
#phone .pg{position:absolute;inset:0;padding:48px 14px 30px;overflow-y:auto;overflow-x:hidden;transition:transform .38s cubic-bezier(.2,.9,.3,1),opacity .3s;scrollbar-width:none}
#phone .pg::-webkit-scrollbar{display:none}
#phone .pg.out{transform:translateX(-30%);opacity:0;pointer-events:none} #phone .pg.new{transform:translateX(100%)}
#phone .ah{display:flex;align-items:center;gap:8px;margin:2px 0 12px} #phone .ah h2{margin:0;font-size:24px;font-weight:800;letter-spacing:-.5px;flex:1}
#phone .back{border:0;background:none;color:var(--acc,#0a84ff);font:inherit;font-size:14px;font-weight:600;display:flex;align-items:center;gap:2px;cursor:pointer;padding:4px 0}
#phone .back svg{width:20px;height:20px}
#phone .hero{border-radius:22px;padding:14px;color:#fff;background:var(--g);margin-bottom:12px;position:relative;overflow:hidden}
#phone .hero::after{content:'';position:absolute;right:-30px;top:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.12)}
#phone .hero b{display:block;font-size:22px;font-weight:800} #phone .hero small{opacity:.9;font-size:11.5px;font-weight:600}
#phone .card{background:var(--card2);border-radius:18px;padding:12px;margin-bottom:10px;color:var(--ink)}
#phone.light .card{box-shadow:0 1px 3px rgba(0,0,0,.06)}
#phone .card h4{margin:0 0 6px;font-size:13px;font-weight:800} #phone .card h4 svg{width:16px;height:16px;vertical-align:-3px;margin-right:2px} #phone .card p{margin:0;font-size:11.5px;color:var(--sub);line-height:1.4}
#phone .row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(127,127,127,.18);font-size:12.5px;cursor:pointer}
#phone .row:last-child{border-bottom:0} #phone .row > svg{width:18px;height:18px;flex:none;color:var(--sub)} #phone .row .ri{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:var(--g,#555);flex:none}
#phone .row .ri svg{width:18px;height:18px;stroke:#fff} #phone .row .rt{flex:1;min-width:0} #phone .row .rt b{display:block;font-size:12.5px} #phone .row .rt small{color:var(--sub);font-size:11px}
#phone .row .rv{font-weight:700;font-size:12px;white-space:nowrap} #phone .row .rv.pos{color:#2fbf5a} #phone .row .rv.neg{color:#ff5a4f}
#phone .btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;border:0;border-radius:14px;padding:12px;font:inherit;font-size:13.5px;font-weight:800;color:#fff;background:var(--acc,#0a84ff);cursor:pointer;margin-top:8px;transition:transform .15s,filter .15s}
#phone .btn:active{transform:scale(.96)} #phone .btn.sec{background:var(--card);color:var(--ink)} #phone .btn.red{background:#ff3b30} #phone .btn svg{width:17px;height:17px}
#phone .btn[disabled]{filter:grayscale(1) opacity(.5);pointer-events:none}
#phone .seg{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;background:var(--card);border-radius:12px;padding:3px;margin-bottom:12px;position:relative}
#phone .seg button{border:0;background:none;font:inherit;font-size:12px;font-weight:700;color:var(--ink);padding:7px;border-radius:9px;cursor:pointer;position:relative;z-index:1;transition:color .2s}
#phone .seg .k{position:absolute;top:3px;bottom:3px;border-radius:9px;background:var(--acc,#0a84ff);transition:left .3s cubic-bezier(.3,1.3,.5,1),width .3s}
#phone .seg button.on{color:#fff}
#phone .inp{width:100%;box-sizing:border-box;border:0;border-radius:12px;padding:10px 12px 10px 34px;font:inherit;font-size:13px;background:var(--card);color:var(--ink);outline:none;-webkit-user-select:text;user-select:text}
#phone .srch{position:relative;margin-bottom:8px} #phone .srch svg{position:absolute;left:10px;top:50%;margin-top:-8px;width:16px;height:16px;stroke:var(--sub)}
#phone .sw{display:flex;flex-wrap:wrap;gap:8px} #phone .sw button{width:34px;height:34px;border-radius:50%;border:3px solid transparent;cursor:pointer;background:var(--c);box-shadow:inset 0 0 0 1px rgba(0,0,0,.2);transition:transform .2s cubic-bezier(.3,1.6,.5,1)}
#phone .sw button.on{border-color:var(--acc,#0a84ff);transform:scale(1.12)}
#phone .walls{display:grid;grid-template-columns:repeat(4,1fr);gap:8px} #phone .walls button{aspect-ratio:9/16;border-radius:10px;border:3px solid transparent;background:var(--w);background-size:cover;cursor:pointer;transition:transform .2s}
#phone .walls button.on{border-color:var(--acc,#0a84ff);transform:scale(1.05)}
#phone .tg{display:flex;align-items:center;justify-content:space-between;padding:8px 0;font-size:12.5px;font-weight:600}
#phone .tg i{width:44px;height:26px;border-radius:13px;background:rgba(127,127,127,.4);position:relative;cursor:pointer;transition:background .25s;flex:none}
#phone .tg i::after{content:'';position:absolute;left:2px;top:2px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.25);transition:left .25s cubic-bezier(.3,1.5,.5,1)}
#phone .tg i.on{background:#34c759} #phone .tg i.on::after{left:20px}
#phone .bar{height:6px;border-radius:3px;background:rgba(127,127,127,.25);overflow:hidden} #phone .bar i{display:block;height:100%;background:var(--acc,#0a84ff);border-radius:3px;transition:width .6s}
#phone .vg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px} #phone .vg button{border:0;border-radius:14px;background:var(--card);color:var(--ink);font:inherit;font-size:11px;font-weight:700;padding:10px 4px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;transition:transform .15s}
#phone .vg button svg{width:22px;height:22px} #phone .vg button.on{background:var(--acc,#0a84ff);color:#fff} #phone .vg button:active{transform:scale(.94)}
#phone .stnk{border-radius:20px;padding:12px;margin-bottom:12px;background:linear-gradient(150deg,#e9eef4,#c9d4df);color:#16171a;position:relative;overflow:hidden}
#phone .stnk::before{content:'';position:absolute;right:-40px;bottom:-60px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,.35)}
#phone .stnk .hd{display:flex;justify-content:space-between;align-items:center;font-size:9.5px;font-weight:800;letter-spacing:.08em;opacity:.7;margin-bottom:8px}
#phone .plate{display:inline-flex;flex-direction:column;align-items:center;border:3px solid var(--pf);background:var(--pb);color:var(--pf);border-radius:7px;padding:4px 12px 3px;font-family:Overpass,Archivo,sans-serif;box-shadow:0 3px 8px rgba(0,0,0,.25);position:relative}
#phone .plate b{font-size:22px;font-weight:800;letter-spacing:1.5px;line-height:1} #phone .plate small{font-size:9.5px;font-weight:700;opacity:.9}
#phone .stnk dl{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;margin:10px 0 0;font-size:11.5px;position:relative} #phone .stnk dt{opacity:.6;font-weight:600} #phone .stnk dd{margin:0;font-weight:700;display:flex;align-items:center;gap:5px}
#phone .stnk dd i{width:12px;height:12px;border-radius:50%;border:1px solid rgba(0,0,0,.3);display:inline-block}
#phone select.inp{padding-left:12px;appearance:none;-webkit-appearance:none}
#phone input[type=color]{width:34px;height:34px;border-radius:50%;border:0;padding:0;background:none;cursor:pointer}
#phone .gm{position:absolute;inset:0;z-index:1;background:#a8d4f5;overflow:hidden}
#phone .gm canvas{width:100%;height:100%;display:block;touch-action:none;cursor:grab}
#phone .gm .top{position:absolute;left:10px;right:10px;top:46px;display:flex;gap:8px;align-items:center;z-index:3}
#phone .gm .sb{flex:1;display:flex;align-items:center;gap:8px;background:#fff;color:#3c4043;border-radius:24px;padding:10px 14px;font-size:13px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer;border:0;font-family:inherit;text-align:left}
#phone .gm .sb svg{width:18px;height:18px;color:#5f6368} #phone .gm .bk{width:40px;height:40px;border-radius:50%;background:#fff;border:0;display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer;color:#3c4043;flex:none} #phone .gm .bk svg{width:20px;height:20px}
#phone .gm .mv{position:absolute;left:10px;right:10px;top:96px;z-index:3;background:#0f7a3f;color:#fff;border-radius:16px;padding:10px 12px;display:flex;gap:10px;align-items:center;box-shadow:0 4px 12px rgba(0,0,0,.3);animation:phIn .35s both}
#phone .gm .mv svg{width:34px;height:34px;flex:none} #phone .gm .mv b{display:block;font-size:15px;line-height:1.15} #phone .gm .mv small{font-size:11.5px;opacity:.9}
#phone .gm .mv .dd{font-size:20px;font-weight:800;margin-right:2px}
#phone .gm .fab{position:absolute;right:10px;z-index:3;display:flex;flex-direction:column;gap:8px}
#phone .gm .fab button{width:42px;height:42px;border-radius:50%;border:0;background:#fff;color:#1a73e8;display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.28);cursor:pointer;transition:transform .15s}
#phone .gm .fab button:active{transform:scale(.9)} #phone .gm .fab button svg{width:20px;height:20px} #phone .gm .fab button.on{background:#1a73e8;color:#fff} #phone .gm .fab .zb{color:#3c4043;font-size:22px;font-weight:500}
#phone .gm .sheet{position:absolute;left:0;right:0;bottom:0;z-index:3;background:#fff;color:#202124;border-radius:22px 22px 0 0;padding:8px 14px 24px;box-shadow:0 -4px 16px rgba(0,0,0,.18);animation:phUp .4s cubic-bezier(.2,1,.3,1) both}
#phone .gm .traffic-key{display:flex;flex-wrap:wrap;gap:4px 9px;font-size:9px;color:#5f6368;margin:6px 0} #phone .gm .traffic-key i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin-right:3px} #phone .gm .traffic-alert{font-size:10px;margin:5px 0;color:#a13b00} #phone .gm .traffic-alert svg{width:12px;height:12px;vertical-align:middle} #phone .gm .traffic-source{font-size:9px;color:#70757a;margin-bottom:5px} #phone .gm .sheet{max-height:46%;overflow-y:auto} #phone .gm .sheet::before{content:'';display:block;width:36px;height:4px;border-radius:2px;background:#dadce0;margin:0 auto 8px}
#phone .gm .sheet .eta{display:flex;align-items:baseline;gap:6px} #phone .gm .sheet .eta b{font-size:22px;color:#188038;font-weight:800} #phone .gm .sheet .eta span{font-size:13px;color:#5f6368;font-weight:600}
#phone .gm .sheet p{margin:2px 0 8px;font-size:12px;color:#5f6368} #phone .gm .sheet .acts{display:flex;gap:8px}
#phone .gm .sheet .acts button{flex:1;border-radius:20px;border:1px solid #dadce0;background:#fff;color:#1a73e8;font:inherit;font-size:12.5px;font-weight:700;padding:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px}
#phone .gm .sheet .acts button.p{background:#1a73e8;color:#fff;border-color:#1a73e8} #phone .gm .sheet .acts svg{width:16px;height:16px}
@keyframes phUp{from{transform:translateY(100%)}}
#phone .card.mnow{display:flex;flex-direction:row;align-items:center;gap:10px;text-align:left}
#phone .card.mnow>div{display:block;text-align:left}
#phone .mnow .disc{width:46px;height:46px;border-radius:50%;flex:none;display:grid;place-items:center;color:#fff;background:conic-gradient(from 0deg,#e3204d,#ff6a8a,#7a1030,#e3204d);box-shadow:inset 0 0 0 14px rgba(0,0,0,.25)}
#phone .mnow .disc svg{width:18px;height:18px} #phone .mnow.on .disc{animation:phSpin 3s linear infinite}
#phone .mnow div{flex:1;min-width:0} #phone .mnow b{display:block;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} #phone .mnow small{font-size:11.5px;color:var(--sub)}
#phone .mnow button{width:36px;height:36px;border-radius:50%;border:0;background:var(--card);color:var(--ink);display:grid;place-items:center;cursor:pointer;flex:none} #phone .mnow button svg{width:16px;height:16px}
#phone .hint{font-size:11px;color:var(--sub);margin:4px 2px 12px;line-height:1.45}
#phone .mph{border-radius:14px;background:#000;margin-bottom:10px;overflow:hidden}
#phone .mus-item{display:flex;align-items:center;gap:9px;padding:7px 0;margin:0;border:0;border-bottom:1px solid rgba(127,127,127,.18);background:none;border-radius:0}
#phone .mus-item:last-child{border-bottom:0}
#phone .mus-item img{width:42px;height:42px;border-radius:9px;object-fit:cover;background:var(--card);flex:none}
#phone .mus-item img:not([src]){visibility:hidden;width:0;margin-right:-9px}
#phone .mus-item>div:nth-child(2){flex:1;min-width:0} #phone .mus-item b{display:block;font-size:12.5px;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical} #phone .mus-item small{font-size:11px;color:var(--sub)}
#phone .mus-item>div:last-child{display:flex;flex-direction:column;gap:4px} #phone .mus-item button{border:0;border-radius:14px;padding:6px 10px;font:inherit;font-size:11.5px;font-weight:800;background:#e3204d;color:#fff;cursor:pointer}
#phone .mus-item button+button{background:var(--card);color:var(--ink)}
#phone .mus-note{font-size:11.5px;color:var(--sub);padding:4px 0 6px}
@keyframes phSpin{to{transform:rotate(360deg)}}
#phone .map{width:100%;height:250px;border-radius:18px;display:block;background:#e8ecef;margin-bottom:10px}
#phone .pad{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;justify-items:center;margin:8px 0}
#phone .pad button{width:62px;height:62px;border-radius:50%;border:0;background:var(--card);color:var(--ink);font:inherit;font-size:24px;font-weight:500;cursor:pointer;transition:background .15s,transform .15s}
#phone .pad button:active{background:var(--card2);transform:scale(.92)} #phone .num{text-align:center;font-size:30px;font-weight:600;min-height:40px;letter-spacing:1px}
#phone .call{position:absolute;inset:0;z-index:20;background:linear-gradient(170deg,#1d2b3a,#0c1117);color:#fff;display:flex;flex-direction:column;align-items:center;padding-top:90px;animation:phFade .3s both}
#phone .call .av{width:88px;height:88px;border-radius:50%;display:grid;place-items:center;background:var(--g,#3a9fd8);margin-bottom:14px;animation:phRing 1.4s ease-in-out infinite}
#phone .call .av svg{width:42px;height:42px;stroke:#fff} #phone .call h3{margin:0;font-size:24px} #phone .call p{margin:6px 0 0;opacity:.75;font-size:13px}
#phone .call .end{position:absolute;bottom:60px;width:66px;height:66px;border-radius:50%;border:0;background:#ff3b30;display:grid;place-items:center;cursor:pointer}
#phone .call .end svg{width:30px;height:30px;stroke:#fff}
@keyframes phRing{0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,.35)}70%{box-shadow:0 0 0 22px rgba(255,255,255,0)}}
@keyframes phFade{from{opacity:0}}
#phone .radar{width:150px;height:150px;margin:14px auto;border-radius:50%;position:relative;background:radial-gradient(circle,var(--acc) 0 10px,transparent 11px)}
#phone .radar i{position:absolute;inset:0;border-radius:50%;border:2px solid var(--acc);animation:phRad 1.8s ease-out infinite;opacity:0} #phone .radar i:nth-child(2){animation-delay:.6s} #phone .radar i:nth-child(3){animation-delay:1.2s}
@keyframes phRad{from{transform:scale(.1);opacity:1}to{transform:scale(1);opacity:0}}
#phone .gal{display:grid;grid-template-columns:repeat(3,1fr);gap:4px} #phone .gal img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;cursor:pointer;animation:phIn .3s both}
#phone .shot{position:relative;border-radius:18px;overflow:hidden;background:#000;aspect-ratio:3/4;margin-bottom:12px}
#phone .shot canvas{width:100%;height:100%;object-fit:cover;display:block}
#phone .shut{width:70px;height:70px;border-radius:50%;border:5px solid #fff;background:#fff;box-shadow:inset 0 0 0 3px #101114;margin:0 auto;display:block;cursor:pointer;transition:transform .12s}
#phone .shut:active{transform:scale(.88)} #phone .flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:30} #phone .flash.go{animation:phFlash .45s}
@keyframes phFlash{0%{opacity:.95}100%{opacity:0}}
#phone .ban{position:absolute;left:8px;right:8px;top:8px;z-index:25;background:var(--sheet);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);color:var(--ink);border-radius:20px;padding:10px 12px;display:flex;gap:10px;align-items:center;transform:translateY(-130%);transition:transform .45s cubic-bezier(.2,1.3,.4,1);box-shadow:0 10px 26px rgba(0,0,0,.3);cursor:pointer}
#phone .ban.on{transform:translateY(0)} #phone .ban .ri{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--g);flex:none} #phone .ban .ri svg{width:19px;height:19px;stroke:#fff}
#phone .ban b{display:block;font-size:12.5px} #phone .ban small{font-size:11px;color:var(--sub)}
#phone .hind{position:absolute;left:50%;bottom:8px;width:120px;height:5px;margin-left:-60px;border-radius:3px;background:var(--ink);opacity:.85;z-index:12;cursor:pointer}
#phone .hind::before{content:'';position:absolute;inset:-12px -20px}
#phone .x{position:absolute;right:-12px;top:-12px;width:34px;height:34px;border-radius:50%;border:2px solid #fff;background:#16171a;color:#fff;display:grid;place-items:center;cursor:pointer;z-index:40;box-shadow:0 4px 12px rgba(0,0,0,.4)}
#phone .x svg{width:16px;height:16px}
#phone .chip{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:20px;background:var(--card);margin:0 4px 4px 0}
#phone .menu{display:grid;grid-template-columns:1fr 1fr;gap:8px} #phone .menu button{border:0;border-radius:16px;background:var(--card2);color:var(--ink);font:inherit;text-align:left;padding:10px;cursor:pointer;transition:transform .15s}
#phone .menu button:active{transform:scale(.95)} #phone .menu b{display:block;font-size:12px} #phone .menu small{font-size:11px;color:var(--sub)} #phone .menu .em{font-size:26px;display:block;margin-bottom:2px}
#phone .thr{display:flex;flex-direction:column;gap:6px;padding-bottom:64px}
#phone .bub{max-width:78%;padding:8px 11px;border-radius:18px;font-size:12.5px;line-height:1.35;word-wrap:break-word;animation:phIn .25s both}
#phone .bub.me{align-self:flex-end;background:var(--acc,#0a84ff);color:#fff;border-bottom-right-radius:6px} #phone .bub.them{align-self:flex-start;background:var(--card2);color:var(--ink);border-bottom-left-radius:6px}
#phone .bub small{display:block;font-size:9.5px;opacity:.75;margin-top:2px;text-align:right}
#phone .cmp{position:absolute;left:0;right:0;bottom:0;padding:8px 10px 22px;display:flex;gap:6px;background:var(--sheet);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);z-index:3}
#phone .cmp .inp{padding-left:12px;border-radius:18px} #phone .cmp button{width:38px;height:38px;border-radius:50%;border:0;background:var(--acc,#0a84ff);color:#fff;display:grid;place-items:center;cursor:pointer;flex:none}
#phone .cmp button svg{width:18px;height:18px}
#phone .myno{font-size:12px;color:var(--sub);text-align:center;margin:-4px 0 6px} #phone .myno b{color:var(--ink)}
#phone .on-dot{width:9px;height:9px;border-radius:50%;background:#34c759;display:inline-block;margin-right:4px;box-shadow:0 0 6px #34c759}
#phone .call .acts{position:absolute;bottom:56px;left:0;right:0;display:flex;justify-content:space-around;padding:0 30px}
#phone .call .acts button{width:64px;height:64px;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;color:#fff;transition:transform .15s}
#phone .call .acts button:active{transform:scale(.9)} #phone .call .acts svg{width:28px;height:28px}
#phone .call .acts .ok{background:#34c759;animation:phNudge 1.2s ease-in-out infinite} #phone .call .acts .no{background:#ff3b30} #phone .call .acts .tg2{background:rgba(255,255,255,.18)} #phone .call .acts .tg2.on{background:#fff;color:#111}
#phone .call .lbl{display:flex;justify-content:space-around;position:absolute;bottom:34px;left:0;right:0;padding:0 30px;font-size:11px;opacity:.8}
@keyframes phNudge{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
#phbtn.ring{animation:phShake .5s}
@keyframes phShake{20%{transform:rotate(-12deg)}40%{transform:rotate(10deg)}60%{transform:rotate(-8deg)}80%{transform:rotate(5deg)}}
#phbtn{position:relative} #phbtn .bd{position:absolute;right:2px;top:2px;min-width:15px;height:15px;border-radius:8px;background:#ff3b30;color:#fff;font-size:9.5px;font-weight:800;display:grid;place-items:center;padding:0 3px}
@media (max-width:700px), (max-height:560px){ #phone{right:50%;bottom:50%;transform-origin:50% 50%;margin:0 -150px -310px 0} #phone.on{transform:scale(var(--ps,1))} }
`;

// wallpapers, case colours, icon gradients
const WALLS = {
  aurora: 'linear-gradient(165deg,#0b1d3a 0%,#1f4f8a 42%,#3fc1c9 78%,#a6f0c6 100%)',
  senja: 'linear-gradient(170deg,#2b1055 0%,#7a2e8a 35%,#ec6a4a 70%,#ffc46b 100%)',
  tol: 'repeating-linear-gradient(100deg,transparent 0 46%,rgba(242,194,48,.85) 46% 47%,transparent 47% 100%),linear-gradient(180deg,#1b2a3a 0%,#2c3a46 55%,#3b3d40 55%,#2a2b2e 100%)',
  hutan: 'linear-gradient(160deg,#0f3d2e 0%,#2f7a55 50%,#9ad07a 100%)',
  malam: 'radial-gradient(circle at 70% 20%,#fdf6c9 0 3%,transparent 3.5%),radial-gradient(circle at 20% 30%,#fff 0 .4%,transparent .6%),radial-gradient(circle at 40% 15%,#fff 0 .3%,transparent .5%),linear-gradient(180deg,#05070f 0%,#14213d 60%,#2c3e66 100%)',
  merah: 'linear-gradient(150deg,#3a0a0a 0%,#ec3013 60%,#ff9a6b 100%)',
  pastel: 'linear-gradient(160deg,#f8d7e8 0%,#d6e4ff 50%,#c9f2e7 100%)',
  batik: 'radial-gradient(circle at 25% 25%,#d4af37 0 9%,transparent 10%),radial-gradient(circle at 75% 75%,#d4af37 0 9%,transparent 10%),radial-gradient(circle at 75% 25%,#7a3b1a 0 6%,transparent 7%),radial-gradient(circle at 25% 75%,#7a3b1a 0 6%,transparent 7%),#3a1f10'};
const WALL_NAME = {aurora: 'Aurora', senja: 'Senja', tol: 'Jalan tol', hutan: 'Hutan', malam: 'Malam', merah: 'Merah', pastel: 'Pastel', batik: 'Batik'};
const CASES = ['#1b1c1f', '#c9ccd0', '#d4af37', '#1f3f73', '#b02020', '#2f5a4a', '#5b3a8a', '#e48aa8', '#f2f2ee', '#f07a1a'];
const ACCS = ['#0a84ff', '#34c759', '#ff9f0a', '#ff375f', '#bf5af2', '#ec3013'];
const G = {appstore: 'linear-gradient(145deg,#42b2ff,#1358c8)',ojek: 'linear-gradient(145deg,#2fdc6a,#00873a)', blue: 'linear-gradient(145deg,#4aa3ff,#0b3f9e)', kendaraan: 'linear-gradient(145deg,#ff8a4a,#d9361e)', peta: 'linear-gradient(145deg,#6ee7b7,#0e9f6e 55%,#3b82f6)',
  dompet: 'linear-gradient(145deg,#ffd35a,#e08a00)', telepon: 'linear-gradient(145deg,#5df07a,#18a33a)', pesan: 'linear-gradient(145deg,#66e08a,#1fae4f)', musik: 'linear-gradient(145deg,#ff6a8a,#e3204d)',
  kamera: 'linear-gradient(145deg,#9aa3ad,#3a4048)', kontak: 'linear-gradient(145deg,#a0a7b2,#5f6773)', galeri: 'conic-gradient(from 45deg,#ff5f6d,#ffc371,#47e37a,#3fa9ff,#c26bff,#ff5f6d)', cuaca: 'linear-gradient(145deg,#7cc7ff,#2a6fd8)', terbang: 'linear-gradient(145deg,#8fe0ff,#0d5bd1)', setelan: 'linear-gradient(145deg,#b8bec6,#5d656e)',
  derek: 'linear-gradient(145deg,#ffcf3a,#e58a00)', polisi: 'linear-gradient(145deg,#4a6bd8,#1a2f80)', amb: 'linear-gradient(145deg,#ff6a6a,#c81e1e)'};
const APPS = [
  {k: 'appstore', name: 'App Store', icon: 'AppWindow'},
  {k: 'ojek', name: 'Ojek', icon: 'Bike'}, {k: 'blue', name: 'Blue', icon: 'CarTaxiFront'}, {k: 'kendaraan', name: 'Kendaraan', icon: 'Car'}, {k: 'peta', name: 'Peta', icon: 'MapPinned'},
  {k: 'terbang', name: 'Terbang', icon: 'Plane'}, {k: 'dompet', name: 'Dompet', icon: 'Wallet'}, {k: 'cuaca', name: 'Cuaca', icon: 'CloudSun'}, {k: 'kamera', name: 'Kamera', icon: 'Camera'}, {k: 'galeri', name: 'Galeri', icon: 'Images'},
  {k: 'musik', name: 'Musik', icon: 'Music'}, {k: 'kontak', name: 'Kontak', icon: 'Contact'}, {k: 'setelan', name: 'Pengaturan', icon: 'Settings'}];
const DOCK = [{k: 'telepon', name: 'Telepon', icon: 'Phone'}, {k: 'pesan', name: 'Pesan', icon: 'MessageCircle'}, {k: 'peta', name: 'Peta', icon: 'MapPinned'}, {k: 'kamera', name: 'Kamera', icon: 'Camera'}];
const FOODS = [
  {name: 'Nasi goreng', em: '🍛', price: 25000, fresh: 15}, {name: 'Sate ayam', em: '🍢', price: 30000, fresh: 15}, {name: 'Bakso', em: '🍜', price: 22000, fresh: 15},
  {name: 'Kopi susu', em: '☕', price: 18000, fresh: 30}, {name: 'Es teh manis', em: '🧋', price: 8000, fresh: 10}, {name: 'Martabak', em: '🥞', price: 35000, fresh: 15}];
const VEH_IC = {car: 'Car', suv: 'CarFront', pickup: 'Truck', taxi: 'CarTaxiFront', moto: 'Bike', bicycle:'Bike', bus: 'Bus', truck: 'Truck', angkot: 'BusFront', ambulance: 'Ambulance', damkar: 'Siren', police: 'Shield'};
const DRIVERS = ['Budi Santoso', 'Siti Rahma', 'Agus Pratama', 'Dewi Lestari', 'Rudi Hartono', 'Wayan Sudarma', 'Joko Susilo', 'Rina Wulandari', 'Andi Saputra', 'Putu Ayu'];

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
// an icon of the button icon set as inline SVG (the set is loaded as a global by the page)
function ic(name){ const L = window.lucide && window.lucide.icons, node = L && L[name]; if (!node) return '<svg viewBox="0 0 24 24"></svg>';
  const kids = (node[2] || node).map(([tag, a]) => `<${tag} ${Object.entries(a).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}/>`).join('');
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${kids}</svg>`; }

export const phIcon = name => ic(name);
export function initPhone(A){
  const st = document.createElement('style'); st.textContent = CSS + STORE_CSS + HOME_CSS; document.head.append(st);
  const P = Object.assign({wall: 'aurora', case: '#1b1c1f', theme: 'dark', acc: '#0a84ff', shape: 15, owner: 'Pengemudi 7MIT', photoWall: null, warn: true}, A.cfg.phone || {});
  const save = () => { A.cfg.phone = {...P, photoWall: null}; A.saveCfg(); };
  const el = document.createElement('div'); el.id = 'phone'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Handphone');
  el.innerHTML = `<div class="hb pw"></div><div class="hb v1"></div><div class="hb v2"></div><button class="x" aria-label="Tutup HP">${ic('X')}</button>
    <div class="case"><div class="scr"><div class="wall"></div><div class="isl"></div>
      <div class="stat"><span class="t">--:--</span><span class="r">${ic('SignalHigh')}${ic('Wifi')}<span class="bt">100%</span>${ic('BatteryFull')}</span></div>
      <div class="lock"><div class="d"></div><div class="t">--:--</div><div class="o"></div><div class="nl"></div><div class="sw">Geser ke atas untuk membuka</div></div>
      <div class="home"><div class="wid"></div><div class="home-tools"></div><div class="launcher"><div class="home-search-tools"><input class="inp home-search" aria-label="Cari aplikasi terpasang" placeholder="Cari aplikasi di HP…" maxlength="100"><button class="home-edit" data-home-action="edit" aria-label="Edit layar utama">${ic('SlidersHorizontal')}</button></div><div class="home-pages" tabindex="0" role="region" aria-label="Halaman aplikasi, geser kanan atau kiri"></div><div class="page-nav"><button class="page-arrow" data-home-prev aria-label="Halaman sebelumnya">${ic('ChevronLeft')}</button><div class="page-dots"></div><button class="page-arrow" data-home-next aria-label="Halaman berikutnya">${ic('ChevronRight')}</button></div></div><div class="dock"></div></div>
      <div class="app"></div><div class="ban"></div><div class="flash"></div><div class="hind" title="Layar utama"></div></div></div>`;
  document.body.append(el);
  const q = s => el.querySelector(s), scr = q('.scr'), app = q('.app'), lock = q('.lock'), home = q('.home'), ban = q('.ban'), isl = q('.isl');
  let open = false, cur = null, stack = [], badges = {}, unread = [], banT = 0, gallery = [], lastNote = [];

  // ---------- look: case, wallpaper, theme, accent, icon shape; fits the window ----------
  function look(){ el.style.setProperty('--case', P.case); el.style.setProperty('--wall', P.photoWall ? `url(${P.photoWall})` : WALLS[P.wall] || WALLS.aurora);
    el.style.setProperty('--rad', P.shape + 'px'); scr.style.setProperty('--acc', P.acc); el.classList.toggle('light', P.theme === 'light');
    const s = Math.min(1, (innerHeight - (innerWidth < 700 || innerHeight < 560 ? 30 : 150))/620, (innerWidth - 24)/300); el.style.setProperty('--ps', Math.max(0.55, s).toFixed(3)); }
  addEventListener('resize', look);
  // ---------- home screen ----------
  const icon = a => `<button class="ic" data-app="${a.k}" aria-label="${esc(a.name)}"><i style="--g:${a.gradient || G[a.k]}">${ic(a.icon)}</i><span>${esc(a.name)}</span>${badges[a.k] ? `<b class="bd">${badges[a.k]}</b>` : ''}</button>`;
  function drawHome(anim){ HOME.render(anim); }
  function widgets(){ HOME.widgets(); }
  el.addEventListener('keydown', e => { if (e.target.closest('input,textarea,select,[contenteditable]')) e.stopPropagation(); });
  // ---------- lock screen: swipe (or tap) up to unlock ----------
  let lk = null;
  lock.addEventListener('pointerdown', e => { lk = {y: e.clientY, id: e.pointerId}; lock.setPointerCapture(e.pointerId); lock.style.transition = 'none'; });
  lock.addEventListener('pointermove', e => { if (!lk) return; const dy = Math.min(0, e.clientY - lk.y); lock.style.transform = `translateY(${dy}px)`; lock.style.opacity = String(1 + dy/300); });
  lock.addEventListener('pointerup', e => { if (!lk) return; const dy = e.clientY - lk.y; lk = null; lock.style.transition = ''; lock.style.transform = ''; lock.style.opacity = '';
    if (dy < -60 || Math.abs(dy) < 6) unlock(); });
  function unlock(){ A.sfx('unlock'); lock.classList.add('gone'); drawHome(true); }
  function lockNow(){ HOME.finish(); lock.classList.remove('gone'); closeApp(true); }
  // ---------- open / close ----------
  function toggle(force){ open = force ?? !open; if (!open) HOME.finish(); el.classList.toggle('on', open); A.onToggle(open); musPos();
    if (open) { look(); lockNow(); tickClock(); renderLockNotes(); clearBadge('all');
      if (P.warn && A.state().kmh > 15 && !A.state().auto && !A.state().ride) A.toast('Hati-hati: main HP sambil menyetir itu berbahaya (dan dilarang). Menepi dulu, atau pakai Autopilot', 'warn'); }
    A.sfx(open ? 'open' : 'close'); }
  q('.x').onclick = () => toggle(false);
  q('.hind').onclick = () => { if (HOME.editing) return HOME.finish(); if (cur) closeApp(); else if (!lock.classList.contains('gone')) unlock(); else toggle(false); };
  function openApp(k, from){ if (k === 'terbang') { A.sfx('tap'); toggle(false); setTimeout(() => A.fly(), 250); return; }
    const r = from ? from.getBoundingClientRect() : null, sr = scr.getBoundingClientRect(), sc = sr.width/scr.offsetWidth;
    if (r) { app.style.setProperty('--ox', `${(r.left + r.width/2 - sr.left)/sc}px`); app.style.setProperty('--oy', `${(r.top + r.height/2 - sr.top)/sc}px`); }
    HOME.finish(); cur = k; stack = []; clearBadge(k); app.innerHTML = ''; app.style.setProperty('--g', G[k]); push(k.startsWith('store-') ? pg => STORE.renderApp(pg, k) : APPS_IMPL[k] || APPS_IMPL.stub, true);
    el.classList.add('app-open'); requestAnimationFrame(() => app.classList.add('on')); A.sfx('tap'); }
  function closeApp(instant){ if (!cur) return; cur = null; setTimeout(musPos); stack = []; app.classList.remove('on'); el.classList.remove('app-open'); if (instant) app.innerHTML = ''; else setTimeout(() => { if (!cur) app.innerHTML = ''; }, 420); drawHome(); }
  // a stack of pages inside an app: push slides in from the right, back slides it out
  function push(render, first){ const pg = document.createElement('div'); pg.className = 'pg' + (first ? '' : ' new'); app.append(pg);
    const prev = stack[stack.length - 1]; stack.push({pg, render}); draw(pg, render);
    if (!first) requestAnimationFrame(() => { pg.classList.remove('new'); if (prev) prev.pg.classList.add('out'); }); }
  function back(){ if (stack.length < 2) return closeApp(); const top = stack.pop(), prev = stack[stack.length - 1]; top.pg.classList.add('new'); if (top.cmp) top.cmp.remove(); prev.pg.classList.remove('out'); draw(prev.pg, prev.render); setTimeout(() => top.pg.remove(), 380); A.sfx('tap'); }
  function draw(pg, render){ const entry = stack.find(t => t.pg === pg); if (entry) entry.live = null; const keep = pg.scrollTop; pg.innerHTML = ''; render(pg); pg.scrollTop = keep; }
  const redraw = () => { const t = stack[stack.length - 1]; if (t) draw(t.pg, t.render); };
  const head = title => `<div class="ah"><button class="back" data-back>${ic('ChevronLeft')}${stack.length > 1 ? 'Kembali' : 'Beranda'}</button><h2>${esc(title)}</h2></div>`;
  app.addEventListener('click', e => { if (e.target.closest('[data-back]')) back(); });
  // ---------- notifications: a banner on the phone, or a badge and a shake of the phone button ----------
  function notify(k, title, body){ lastNote.unshift({k, title, body, t: A.state().time}); if (lastNote.length > 20) lastNote.length = 20;
    if (open) { const a = APPS.concat(DOCK).find(x => x.k === k) || {icon: 'Bell'}; ban.innerHTML = `<div class="ri" style="--g:${G[k] || G.setelan}">${ic(a.icon)}</div><div><b>${esc(title)}</b><small>${esc(body)}</small></div>`;
      ban.classList.add('on'); ban.onclick = () => { ban.classList.remove('on'); if (lock.classList.contains('gone')) openApp(k); }; clearTimeout(banT); banT = setTimeout(() => ban.classList.remove('on'), 3200);
      isl.classList.add('big'); isl.innerHTML = `<span class="dot"></span>${esc(title)}`; setTimeout(() => { isl.classList.remove('big'); isl.innerHTML = ''; }, 2400); if (!lock.classList.contains('gone')) renderLockNotes(); }
    else { badges[k] = (badges[k] || 0) + 1; const b = A.btn; if (b) { b.classList.remove('ring'); void b.offsetWidth; b.classList.add('ring'); setBtnBadge(); } } }
  function clearBadge(k){ if (k === 'all') { setBtnBadge(0); return; } delete badges[k]; }
  function setBtnBadge(n){ const b = A.btn; if (!b) return; let d = b.querySelector('.bd'); const c = n ?? Object.values(badges).reduce((a, x) => a + x, 0);
    if (!c) { if (d) d.remove(); return; } if (!d) { d = document.createElement('b'); d.className = 'bd'; b.append(d); } d.textContent = c > 9 ? '9+' : c; }
  function renderLockNotes(){ q('.lock .nl').innerHTML = lastNote.slice(0, 3).map((n, i) => `<div style="animation-delay:${i*70}ms"><b>${esc(n.title)}</b> · ${esc(n.body)}</div>`).join(''); }
  // ---------- clock, battery, live app refresh ----------
  let clkT = 0, liveT = 0, batt = 100;
  function tickClock(){ const s = A.state(), d = new Date(); q('.stat .t').textContent = s.time; q('.lock .t').textContent = s.time;
    q('.lock .d').textContent = d.toLocaleDateString('id-ID', {weekday: 'long', day: 'numeric', month: 'long'}); q('.lock .o').textContent = P.owner;
    q('.stat .bt').textContent = Math.round(batt) + '%'; }
  function tick(dt){ if (!open) return; batt = Math.max(5, batt - dt*0.004);
    if ((clkT -= dt) < 0) { clkT = 1; tickClock(); if (!cur && lock.classList.contains('gone')) widgets(); }
    if (cur && (liveT -= dt) < 0) { liveT = 0.5; const t = stack[stack.length - 1]; if (t && t.live) t.live(t.pg); } }
  const live = fn => { const t = stack[stack.length - 1]; if (t) t.live = fn; };

  // ---------- shared bits for the apps ----------
  const seg = (opts, val, cb) => { const w = document.createElement('div'); w.className = 'seg'; w.innerHTML = `<i class="k"></i>` + opts.map(([k, l]) => `<button data-k="${k}" class="${k === val ? 'on' : ''}">${esc(l)}</button>`).join('');
    const place = () => { const b = w.querySelector('button.on'); if (b) Object.assign(w.querySelector('.k').style, {left: b.offsetLeft + 'px', width: b.offsetWidth + 'px'}); };
    requestAnimationFrame(place); w.onclick = e => { const b = e.target.closest('button'); if (!b) return; w.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); place(); A.sfx('tap'); cb(b.dataset.k); }; return w; };
  const html = (pg, h) => { pg.insertAdjacentHTML('beforeend', h); return pg.lastElementChild; };
  // destination picker: search the network's towns, gates and junctions, nearest first
  function pickDest(title, onPick, filter){ push(pg => { pg.innerHTML = head(title) + `<div class="srch">${ic('Search')}<input class="inp" placeholder="Cari kota atau gerbang tol…" autocomplete="off"></div><div class="lst card" style="padding:4px 12px"></div>`;
    const inp = pg.querySelector('input'), lst = pg.querySelector('.lst');
    const show = () => { const r = A.places(inp.value, filter).slice(0, 14); lst.innerHTML = r.map(n => `<div class="row" data-k="${esc(n.key)}"><span class="ri" style="--g:${n.kind === 'k' ? G.peta : G.blue}">${ic(n.kind === 'k' ? 'Building2' : n.kind === 'j' ? 'Split' : 'MapPin')}</span><span class="rt"><b>${esc(n.name)}</b><small>${esc(n.sub)}</small></span><span class="rv">${n.km} km</span></div>`).join('') || '<p style="padding:10px 0">Tidak ditemukan</p>'; };
    inp.oninput = show; show(); lst.onclick = e => { const r = e.target.closest('.row'); if (r) onPick(r.dataset.k); }; }); }
  const errOr = (msg, ok) => { if (msg != null) { if (msg) A.toast(msg, 'warn'); A.sfx('err'); return false; } if (ok) ok(); return true; };

  // ---------- the apps ----------
  const APPS_IMPL = {};
  const STORE = createPhoneStore({A, P, save, head, ic, esc, html, push, redraw, live, drawHome, openApp, setAccent: color => scr.style.setProperty('--acc', color)});
  const HOME = createPhoneHome({home, P, A, save, icon, ic, esc, openApp,
    getApps: () => [...APPS, ...DOCK.filter(a => !APPS.some(b => a.k === b.k)), ...STORE.installed()],
    isInstalled: id => STORE.library.has(id), uninstall: id => STORE.uninstall(id)});
  APPS_IMPL.appstore = STORE.renderStore;
  APPS_IMPL.stub = pg => { pg.innerHTML = head('Segera hadir'); };

  // Ojek: ride as a passenger, order food, or work as an ojol driver / food courier
  let ojTab = 'naik';
  APPS_IMPL.ojek = pg => { scr.style.setProperty('--acc', '#00aa13');
    pg.innerHTML = head('Ojek') + `<div class="hero" style="--g:${G.ojek}"><small>Halo, ${esc(P.owner)}</small><b>Mau ke mana hari ini?</b><small>Ojek · makanan · jadi driver</small></div>`;
    pg.append(seg([['naik', 'Naik ojek'], ['makan', 'Makanan'], ['driver', 'Jadi driver']], ojTab, k => { ojTab = k; redraw(); }));
    const s = A.state();
    if (ojTab === 'naik') {
      if (s.ride) return rideCard(pg);
      html(pg, `<div class="card"><h4>Ojek motor</h4><p>Motor dan pengemudinya datang menjemput; kamu duduk di belakang (autopilot), bayar tunai saat tiba. Rp 10.000 + Rp 2.500/km. Ojek tidak lewat jalan tol.</p></div>`);
      const b = html(pg, `<button class="btn">${ic('MapPin')} Pilih tujuan</button>`); b.onclick = () => pickDest('Tujuan ojek', key => bookRide('ojek', key), 'nontol');
    } else if (ojTab === 'makan') {
      html(pg, `<div class="card"><h4>Pesan makanan</h4><p>Diantar kurir ke posisimu dalam 1–2 menit. Makan dan minum mengurangi rasa kantuk.</p></div>`);
      const m = html(pg, `<div class="menu">${FOODS.map((f, i) => `<button data-i="${i}"><span class="em">${f.em}</span><b>${esc(f.name)}</b><small>${A.rp(f.price)} · kantuk −${f.fresh}%</small></button>`).join('')}</div>`);
      m.onclick = e => { const b = e.target.closest('button'); if (!b) return; const f = FOODS[+b.dataset.i]; errOr(A.orderFood(f), () => { A.sfx('ok'); A.toast(`${f.name} dipesan · kurir menuju lokasimu`); redraw(); }); };
      const pend = A.foodPending(); if (pend.length) html(pg, `<div class="card" style="margin-top:10px"><h4>Pesanan berjalan</h4>${pend.map(f => `<div class="row"><span class="rt"><b>${f.em} ${esc(f.name)}</b><small>Kurir dalam perjalanan</small></span><span class="rv">${f.eta}s</span></div>`).join('')}</div>`);
      live(() => { if (A.foodPending().length !== pend.length) redraw(); });
    } else driverTab(pg, [['ojek', 'Ojek online', 'Bike'], ['food', 'Antar makanan', 'UtensilsCrossed'], ['food_bicycle','Kurir makanan · sepeda','Bike']]); };
  // Blue: taxi rides and parcels as a customer; taxi driver or freight truck driver as work
  let blTab = 'taksi';
  APPS_IMPL.blue = pg => { scr.style.setProperty('--acc', '#1f6fd8');
    pg.innerHTML = head('Blue') + `<div class="hero" style="--g:${G.blue}"><small>Taksi & ekspedisi</small><b>Blue · selalu siap</b><small>Taksi argo · kirim paket se-Jawa · jadi pengemudi</small></div>`;
    pg.append(seg([['taksi', 'Taksi'], ['paket', 'Kirim paket'], ['kerja', 'Jadi pengemudi']], blTab, k => { blTab = k; redraw(); }));
    const s = A.state();
    if (blTab === 'taksi') { if (s.ride) return rideCard(pg);
      html(pg, `<div class="card"><h4>Taksi argo</h4><p>Taksi menjemput dan mengantar lewat tol bila perlu; kamu penumpang (autopilot). Argo Rp 7.500 + Rp 6.500/km, tarif tol termasuk.</p></div>`);
      const b = html(pg, `<button class="btn">${ic('MapPin')} Pilih tujuan</button>`); b.onclick = () => pickDest('Tujuan taksi', key => bookRide('taksi', key));
    } else if (blTab === 'paket') {
      let kg = 1; html(pg, `<div class="card"><h4>Kirim paket</h4><p>Kurir Blue menjemput paketmu dan mengantar ke kota tujuan. Lacak perjalanannya di sini.</p></div>`);
      pg.append(seg([['1', '1 kg'], ['5', '5 kg'], ['20', '20 kg']], '1', k => { kg = +k; }));
      const b = html(pg, `<button class="btn">${ic('Package')} Pilih kota tujuan</button>`);
      b.onclick = () => pickDest('Kirim ke', key => errOr(A.sendParcel(key, kg), () => { A.sfx('ok'); A.toast('Paket dikirim · lacak di Blue'); back(); }), 'kota');
      const list = html(pg, `<div class="card" style="margin-top:10px"><h4>Lacak paket</h4><div class="pl"></div></div>`);
      const fill = () => { const ps = A.parcels(); list.querySelector('.pl').innerHTML = ps.length ? ps.map(p => `<div class="row" style="cursor:default"><span class="ri" style="--g:${G.blue}">${ic(p.done ? 'PackageCheck' : 'Truck')}</span><span class="rt"><b>${esc(p.id)} → ${esc(p.to)}</b><small>${p.done ? 'Terkirim' : p.f < 0.15 ? 'Dijemput kurir' : p.f < 0.85 ? 'Dalam perjalanan · ' + Math.round(p.km) + ' km' : 'Hampir sampai'}</small><div class="bar" style="margin-top:5px"><i style="width:${Math.round(p.f*100)}%"></i></div></span></div>`).join('') : '<p>Belum ada kiriman</p>'; };
      fill(); live(fill);
    } else driverTab(pg, [['taksi', 'Pengemudi taksi', 'CarTaxiFront'], ['truk', 'Sopir truk ekspedisi', 'Truck']]); };
  function driverTab(pg, list){ const s = A.state();
    if (s.jobKey && list.some(([k]) => k === s.jobKey)) {
      const c = html(pg, `<div class="card"><h4>${ic('BadgeCheck')} Sedang bekerja: ${esc(s.job)}</h4><p class="g"></p><div class="bar" style="margin:8px 0"><i style="width:100%"></i></div><p class="e"></p></div>`);
      const f = () => { const j = A.state(); c.querySelector('.g').textContent = j.jobGoal; c.querySelector('.e').textContent = 'Pendapatan: ' + A.rp(j.jobEarned); }; f(); live(f);
      html(pg, `<button class="btn red">${ic('CircleStop')} Berhenti bekerja</button>`).onclick = () => { A.jobs.stop(); A.sfx('tap'); redraw(); }; return; }
    html(pg, `<div class="card"><h4>Mulai bekerja</h4><p>Kendaraan diganti otomatis. Setiap order dibayar minimal Rp 3.000.000.</p></div>`);
    for (const [k, name, icn] of list) { const J = A.jobs.list[k]; const r = html(pg, `<div class="card row" style="padding:10px 12px"><span class="ri" style="--g:${G[cur] || G.ojek}">${ic(icn)}</span><span class="rt"><b>${esc(name)}</b><small>${esc(J.pay)}</small></span>${ic('ChevronRight')}</div>`);
      r.onclick = () => errOr(A.jobs.start(k), () => { A.sfx('ok'); redraw(); }); } }
  function bookRide(appK, key){ const name = A.placeName(key); push(pg => { pg.innerHTML = head('Mencari pengemudi') + `<div class="radar"><i></i><i></i><i></i></div><p style="text-align:center;font-size:13px;color:var(--sub)">Menghubungi ${appK === 'ojek' ? 'ojek' : 'taksi'} terdekat ke ${esc(name)}…</p>`; });
    setTimeout(() => { if (!cur) return; const msg = A.ride.start(appK, key); if (msg) { errOr(msg); back(); return; } A.sfx('ok');
      const drv = DRIVERS[Math.floor(Math.random()*DRIVERS.length)]; A.ride.driver = drv; while (stack.length > 1) { const t = stack.pop(); t.pg.remove(); } stack[0].pg.classList.remove('out'); redraw();
      notify(appK === 'ojek' ? 'ojek' : 'blue', 'Pengemudi ditemukan', `${drv} · menuju ${name}`); }, 1800); }
  function rideCard(pg){ const c = html(pg, `<div class="card"><h4>${ic('Navigation')} Dalam perjalanan</h4><div class="row" style="cursor:default"><span class="ri" style="--g:${G.ojek}">${ic('User')}</span><span class="rt"><b class="dn"></b><small>★ 4,9 · pengemudi</small></span></div><p class="to"></p><div class="bar" style="margin:8px 0"><i class="pb"></i></div><p class="fa"></p></div>`);
    const f = () => { const r = A.state().rideInfo; if (!r) return redraw(); c.querySelector('.dn').textContent = A.ride.driver || 'Pengemudi'; c.querySelector('.to').textContent = `Ke ${r.dest} · sisa ${r.left}`;
      c.querySelector('.pb').style.width = Math.round(r.f*100) + '%'; c.querySelector('.fa').textContent = `Argo sekarang ${A.rp(r.fare)} · bayar tunai saat tiba`; }; f(); live(f);
    html(pg, `<button class="btn red">${ic('X')} Batalkan perjalanan</button>`).onclick = () => { A.ride.cancel(); A.sfx('tap'); redraw(); }; }

  // Kendaraan: the vehicle's papers (STNK-style card: plate, type, colours, parts, figures), change vehicle, plate, paint and parts, tow
  APPS_IMPL.kendaraan = pg => { scr.style.setProperty('--acc', '#ff6a2a'); const s0 = A.state(), V = A.veh, I = V.info();
    pg.innerHTML = head('Kendaraan') + `<div class="stnk"><div class="hd"><span>${s0.veh==='bicycle'?'INFORMASI SEPEDA':'SURAT TANDA NOMOR KENDARAAN'}</span><span>${esc(I.gol)}</span></div>
      <span class="plate" style="--pb:${I.plateStyle[0]};--pf:${I.plateStyle[1]}"><b>${esc(I.plate)}</b><small>${esc(I.valid)}</small></span>
      <dl><dt>Jenis</dt><dd>${esc(I.label)}</dd><dt>Tahun</dt><dd>${I.year}</dd><dt>Warna</dt><dd><i style="background:${I.paintHex}"></i>${esc(I.paint)}</dd>
        <dt>Warna kedua</dt><dd>${esc(I.paint2)}</dd><dt>Velg</dt><dd>${esc(I.rim)}</dd><dt>Livery</dt><dd>${esc(I.livery)}</dd><dt>Kaca film</dt><dd>${I.tint}</dd>
        <dt>Aksesori</dt><dd>${[I.spoiler && 'Spoiler', I.low && 'Ceper', I.stripe && 'Strip sport'].filter(Boolean).join(', ') || '—'}</dd><dt>Jenis plat</dt><dd>${esc(I.plateName)}</dd></dl></div>
      <div class="card"><h4>Kondisi</h4><div class="row" style="cursor:default"><span class="ri" style="--g:${G.dompet}">${ic('Fuel')}</span><span class="rt"><b>${esc(s0.fuelLabel || 'BBM')}</b><small class="fu"></small><div class="bar" style="margin-top:4px"><i class="fb"></i></div></span></div>
        <div class="row" style="cursor:default"><span class="ri" style="--g:${G.amb}">${ic('Wrench')}</span><span class="rt"><b>Kerusakan</b><small class="dm"></small><div class="bar" style="margin-top:4px"><i class="db" style="background:#ff5a4f"></i></div></span></div>
        <div class="row" style="cursor:default"><span class="ri" style="--g:${G.blue}">${ic('Gauge')}</span><span class="rt"><b>Kecepatan maks ${I.vmax} km/j</b><small>${s0.veh==='bicycle'?'Tenaga kayuh · tanpa BBM':`Tangki ${I.tank} L · ${I.kml} km/L`} · perjalanan ini ${I.km} km</small></span></div></div>`;
    const stat = () => { const t = A.state(); pg.querySelector('.fu').textContent = `${t.fuel}% · sekarang ${t.kmh} km/j`; pg.querySelector('.fb').style.width = t.fuel + '%'; pg.querySelector('.dm').textContent = t.dmg + '%'; pg.querySelector('.db').style.width = t.dmg + '%'; }; stat(); live(stat);
    html(pg, `<div class="card"><h4>Ganti kendaraan</h4><div class="vg">${V.types.map(([k, l]) => `<button data-v="${k}" class="${k === s0.veh ? 'on' : ''}">${ic(VEH_IC[k] || 'Car')}${esc(l)}</button>`).join('')}</div></div>`).onclick = e => {
      const b = e.target.closest('button'); if (!b || b.dataset.v === s0.veh) return; errOr(V.swap(b.dataset.v), () => { A.sfx('ok'); redraw(); }); };
    const pl = html(pg, `<div class="card"><h4>Plat nomor</h4><input class="inp pn" style="padding-left:12px;margin-bottom:8px;text-transform:uppercase;font-weight:800;letter-spacing:1px" maxlength="11" placeholder="${esc(I.plate)}" value="${esc(V.mods().plate || '')}">
      <select class="inp pc">${I.cats.map(([k, l]) => `<option value="${k}" ${k === I.plateCat ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <p style="margin-top:6px">Kosongkan untuk plat otomatis. Format: wilayah, angka, huruf (mis. B 1234 XYZ).</p><button class="btn ps">${ic('Check')} Simpan plat</button></div>`);
    if(s0.veh==='bicycle')pl.hidden=true;
    pl.querySelector('.ps').onclick = () => errOr(V.setPlate(pl.querySelector('.pn').value, pl.querySelector('.pc').value), () => { A.sfx('ok'); A.toast('Plat nomor diperbarui'); redraw(); });
    const m = V.mods();
    const c = html(pg, `<div class="card"><h4>Cat</h4><div class="sw pa"></div><h4 style="margin-top:12px">Warna kedua (livery)</h4><div class="sw p2"></div><h4 style="margin-top:12px">Velg</h4><div class="sw ri2"></div><h4 style="margin-top:12px">Livery</h4><div class="sw lv" style="gap:6px"></div>
      <div class="tg">Kaca film gelap<i class="tn ${m.tint ? 'on' : ''}"></i></div><div class="tg">Spoiler<i class="sp ${m.spoiler ? 'on' : ''}"></i></div><div class="tg">Ceper (lowered)<i class="lo ${m.low ? 'on' : ''}"></i></div><div class="tg">Strip sport<i class="st ${m.stripe ? 'on' : ''}"></i></div></div>`);
    c.querySelector('.pa').innerHTML = V.paints.map(x => `<button style="--c:${x}" data-c="${x}" class="${x === m.paint ? 'on' : ''}"></button>`).join('') + `<input type="color" class="cc" value="${m.paint}" title="Warna kustom">`;
    c.querySelector('.p2').innerHTML = V.paints.map(x => `<button style="--c:${x}" data-c="${x}" class="${x === m.paint2 ? 'on' : ''}"></button>`).join('');
    c.querySelector('.ri2').innerHTML = V.rims.map(x => `<button style="--c:${x}" data-c="${x}" class="${x === m.rim ? 'on' : ''}"></button>`).join('');
    c.querySelector('.lv').innerHTML = Object.entries(V.liveries).map(([k, l]) => `<span class="chip" data-l="${k}" style="cursor:pointer;${k === m.livery ? 'background:var(--acc);color:#fff' : ''}">${esc(l)}</span>`).join('');
    c.querySelector('.cc').onchange = e => { V.setMod('paint', e.target.value); A.sfx('tap'); redraw(); };
    c.onclick = e => { const t = e.target; if (t.closest('.pa button')) V.setMod('paint', t.dataset.c); else if (t.closest('.p2 button')) V.setMod('paint2', t.dataset.c); else if (t.closest('.ri2 button')) V.setMod('rim', t.dataset.c); else if (t.dataset.l) V.setMod('livery', t.dataset.l);
      else if (t.matches('.tg i')) { const k = t.classList.contains('tn') ? 'tint' : t.classList.contains('sp') ? 'spoiler' : t.classList.contains('lo') ? 'low' : 'stripe'; V.setMod(k, k === 'tint' ? (m.tint ? 0 : 2) : !m[k]); }
      else return; A.sfx('tap'); redraw(); };
    html(pg, `<button class="btn" style="background:#e58a00">${ic('Truck')} Panggil derek</button>`).onclick = () => { A.tow(); A.sfx('tap'); };
    html(pg, `<button class="btn sec">${ic('Fuel')} Layanan rest area (SPBU, bengkel)</button>`).onclick = () => { A.svc(); }; };

  // Peta: a navigation map like the phone map apps: search pill, the next manoeuvre, follow / compass / zoom buttons, an ETA sheet
  const MV = {follow: true, z: 1600, lat: 0, lon: 0};
  APPS_IMPL.peta = pg => { scr.style.setProperty('--acc', '#1a73e8'); pg.style.padding = '0';
    pg.innerHTML = `<div class="gm"><canvas aria-label="Peta"></canvas>
      <div class="top"><button class="bk" data-back aria-label="Kembali">${ic('ChevronLeft')}</button><button class="sb">${ic('Search')}<span>Cari di sini</span></button></div>
      <div class="mvw"></div><div class="fab" style="bottom:178px"><button class="cp" aria-label="Kompas">${ic('Compass')}</button><button class="zb zi" aria-label="Perbesar">+</button><button class="zb zo" aria-label="Perkecil">−</button><button class="lc" aria-label="Ikuti posisi">${ic('LocateFixed')}</button></div>
      <div class="sheet"></div></div>`;
    const cv = pg.querySelector('canvas'), here = () => A.here();
    if (MV.follow || !MV.lat) { const h = here(); MV.lat = h.lat; MV.lon = h.lon; }
    const paint = () => { if (MV.follow) { const h = here(); MV.lat = h.lat; MV.lon = h.lon; } A.gmap(cv, MV); pg.querySelector('.lc').classList.toggle('on', MV.follow); };
    const fillUI = () => { const t = A.state(), n = A.next(), mv = pg.querySelector('.mvw');
      mv.innerHTML = n ? `<div class="mv">${ic(n.icon === 'left' ? 'CornerUpLeft' : n.icon === 'right' ? 'CornerUpRight' : n.icon === 'flag' ? 'Flag' : 'ArrowUp')}<div><span class="dd">${n.d < 1 ? Math.round(n.d*1000/10)*10 + ' m' : n.d.toFixed(n.d < 10 ? 1 : 0).replace('.', ',') + ' km'}</span><b>${esc(n.t)}</b><small>${esc(n.sub)}</small></div></div>` : '';
      const sh = pg.querySelector('.sheet');
      if (t.dest) { const mins = Math.max(1, Math.round(t.leftKm/75*60)); sh.innerHTML = `<div class="eta"><b>${mins >= 60 ? Math.floor(mins/60) + ' j ' + mins % 60 + ' mnt' : mins + ' mnt'}</b><span>(${esc(t.left)})</span></div><p>Tiba ± ${esc(t.arrive)} · ke ${esc(t.dest)} · ${esc(t.place)}</p>
        <div class="acts"><button class="xn">${ic('X')} Akhiri</button><button class="f">${ic('Maximize2')} Peta penuh</button></div>`;
        sh.querySelector('.xn').onclick = () => { A.nav.clear(); A.sfx('tap'); fillUI(); }; }
      else { sh.innerHTML = `<div class="eta"><b style="color:#202124;font-size:17px">${esc(t.place || 'Lokasimu')}</b></div><p>${t.kmh} km/jam · ${esc(t.km)}</p><div class="acts"><button class="p g">${ic('Navigation')} Rute</button><button class="f">${ic('Maximize2')} Peta penuh</button></div>`;
        sh.querySelector('.g').onclick = () => pickDest('Navigasi ke', key => { A.nav.set(key); A.sfx('ok'); back(); }); }
      const traffic = A.traffic(), alerts = traffic.incidents.filter(e => e.ahead).slice(0, 2);
      const info = document.createElement('div');
      info.innerHTML = `<div class="traffic-key"><span><i style="background:#d93025"></i>Macet sekali</span><span><i style="background:#fbbc04"></i>Sedikit macet</span><span><i style="background:#1a73e8"></i>Lancar</span></div><div class="traffic-source">Lalu lintas simulasi pada garis navigasi</div>` + alerts.map(e => `<div class="traffic-alert">${ic(e.type === 'crash' ? 'TriangleAlert' : e.type === 'works' ? 'Construction' : 'ArrowLeftRight')} ${esc(e.title)} · ${e.distanceKm < 1 ? Math.round(e.distanceKm*1000) + ' m' : e.distanceKm.toFixed(1).replace('.', ',') + ' km'}${e.sd !== traffic.sd ? ' · arah berlawanan' : ''}</div>`).join('');
      sh.insertBefore(info, sh.querySelector('.acts'));
      pg.querySelector('.fab').style.bottom = `${sh.offsetHeight + 10}px`;
      sh.querySelector('.f').onclick = () => { toggle(false); A.openAtlas(); }; };
    requestAnimationFrame(() => { paint(); fillUI(); }); let ui = 0; live(() => { paint(); if (++ui % 2 === 0) fillUI(); });
    pg.querySelector('.sb').onclick = () => pickDest('Cari tempat', key => { A.nav.set(key); A.sfx('ok'); back(); });
    pg.querySelector('.zi').onclick = () => { MV.z = Math.min(40000, MV.z*1.6); paint(); A.sfx('tap'); };
    pg.querySelector('.zo').onclick = () => { MV.z = Math.max(60, MV.z/1.6); paint(); A.sfx('tap'); };
    pg.querySelector('.lc').onclick = () => { MV.follow = true; MV.z = Math.max(MV.z, 1200); paint(); A.sfx('tap'); };
    pg.querySelector('.cp').onclick = () => { MV.z = 1600; paint(); };
    // drag to look around (stops following), pinch or wheel to zoom
    const ptr = new Map(); let pin = 0;
    cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, {x: e.clientX, y: e.clientY}); if (ptr.size === 2) { const [p1, p2] = [...ptr.values()]; pin = Math.hypot(p1.x - p2.x, p1.y - p2.y); } };
    cv.onpointermove = e => { const o = ptr.get(e.pointerId); if (!o) return; const sc = cv.getBoundingClientRect().width/cv.clientWidth, dx = (e.clientX - o.x)/sc, dy = (e.clientY - o.y)/sc; o.x = e.clientX; o.y = e.clientY;
      if (ptr.size === 1) { if (Math.abs(dx) + Math.abs(dy) > 0.5) MV.follow = false; MV.lon -= dx/(MV.z*0.992); MV.lat += dy/MV.z; paint(); }
      else if (ptr.size === 2) { const [p1, p2] = [...ptr.values()], d = Math.hypot(p1.x - p2.x, p1.y - p2.y); if (pin) MV.z = Math.min(40000, Math.max(60, MV.z*d/pin)); pin = d; paint(); } };
    cv.onpointerup = cv.onpointercancel = e => { ptr.delete(e.pointerId); if (ptr.size < 2) pin = 0; };
    cv.onwheel = e => { e.preventDefault(); MV.z = Math.min(40000, Math.max(60, MV.z*Math.exp(-e.deltaY*0.0015))); paint(); }; };

  // Dompet: cash, e-Toll, top up, history
  APPS_IMPL.dompet = pg => { scr.style.setProperty('--acc', '#e08a00');
    pg.innerHTML = head('Dompet') + `<div class="hero" style="--g:${G.dompet}"><small>Uang tunai</small><b class="c"></b><small class="e"></small></div>`;
    const f = () => { const s = A.state(); pg.querySelector('.c').textContent = A.rp(s.cash); pg.querySelector('.e').textContent = `Saldo e-Toll ${A.rp(s.etoll)} · pendapatan perjalanan ini ${A.rp(s.earned)}`; }; f(); live(f);
    const t = html(pg, `<div class="card"><h4>Isi saldo e-Toll</h4><div class="sw" style="gap:6px">${[50000, 100000, 500000, 1000000].map(n => `<span class="chip" data-n="${n}" style="cursor:pointer;padding:7px 11px">${A.rpS(n)}</span>`).join('')}</div></div>`);
    t.onclick = e => { const n = +e.target.dataset.n; if (!n) return; errOr(A.topUp(n), () => { A.sfx('coin'); f(); redraw(); }); };
    const log = A.walletLog(); html(pg, `<div class="card"><h4>Riwayat</h4>${log.length ? log.slice(0, 30).map(x => `<div class="row" style="cursor:default"><span class="ri" style="--g:${x.n >= 0 ? G.telepon : G.amb}">${ic(x.n >= 0 ? 'ArrowDownLeft' : 'ArrowUpRight')}</span><span class="rt"><b>${esc(x.why)}</b><small>${x.t}</small></span><span class="rv ${x.n >= 0 ? 'pos' : 'neg'}">${x.n >= 0 ? '+' : '−'}${A.rpS(Math.abs(x.n))}</span></div>`).join('') : '<p>Belum ada transaksi</p>'}</div>`); };

  // ---------- the mobile network: every player has a number; SMS and voice calls between players in real time ----------
  // Numbers are 0800-XXXX-XXXX (+62 800-XXXX-XXXX). Messages and call signalling go over the server's realtime channel 'tj-phone'
  // (presence keyed by number shows who is reachable); the call audio itself goes peer to peer over WebRTC.
  if (!P.no || !/^0800\d{8}$/.test(P.no)) { P.no = '0800' + String(Math.floor(1e7 + Math.random()*9e7)); save(); }
  P.sms = P.sms || {}; P.names = P.names || {}; P.calls = P.calls || [];
  const fmtNo = n => /^0\d{11}$/.test(n) ? `${n.slice(0, 4)}-${n.slice(4, 8)}-${n.slice(8)}` : n, intl = n => /^0\d{11}$/.test(n) ? `+62 ${n.slice(1, 4)}-${n.slice(4, 8)}-${n.slice(8)}` : n;
  const canon = t => { let d = String(t).replace(/\D/g, ''); if (d.startsWith('62')) d = '0' + d.slice(2); return d; };
  const nameOf = n => P.names[n] || (net.online.find(o => o.no === n) || {}).name || fmtNo(n);
  // the network is the multiplayer connection: numbers travel with each player's position, messages and call signalling as 'ph' broadcasts
  const net = {get ready(){ return A.mp.ready(); }, get online(){ return A.mp.peers().filter(o => o.no && o.no !== P.no); }, pend: new Map(), call: null};
  const tx = m => { if (net.ready) A.mp.send({...m, from: P.no, name: P.owner}); };
  const reachable = n => net.online.some(o => o.no === n);
  function onNet(m){ if (!m || m.to !== P.no || !/^0800\d{8}$/.test(m.from || '')) return; if (m.name) P.names[m.from] = P.names[m.from] || String(m.name).slice(0, 24);
    if (m.k === 'sms') { const t = String(m.text || '').slice(0, 300); if (!t) return; addSms(m.from, {me: false, text: t, t: A.state().time}); tx({k: 'ack', to: m.from, id: m.id});
      notify('pesan', nameOf(m.from), t); A.sfx('ok'); if (cur === 'pesan') redraw(); }
    else if (m.k === 'ack') { const r = net.pend.get(m.id); if (r) { r.st = 'Diterima'; net.pend.delete(m.id); save(); if (cur === 'pesan') redraw(); } }
    else callSignal(m); }
  // the group chat of everyone on the server (the multiplayer chat)
  const GRP = []; function groupIn(name, text, sys){ GRP.push({me: false, name, text, sys, t: A.state().time}); if (GRP.length > 80) GRP.shift(); if (!sys) notify('pesan', `Grup · ${name}`, text); if (cur === 'pesan') redraw(); }
  const mpOnly = pg => { html(pg, `<div class="card"><h4>${ic('WifiOff')} Hanya di Multiplayer</h4><p>Telepon, SMS, kontak dan grup chat antar-pemain tersedia saat Multiplayer tersambung. Setiap pemain punya nomor sendiri: nomormu <b style="color:var(--ink)">${fmtNo(P.no)}</b>.</p></div>`);
    html(pg, `<button class="btn">${ic('Users')} Sambungkan Multiplayer</button>`).onclick = () => { toggle(false); A.openSettings(); }; };
  function addSms(n, msg){ const th = P.sms[n] || (P.sms[n] = []); th.push(msg); if (th.length > 60) th.splice(0, th.length - 60);
    const ks = Object.keys(P.sms); if (ks.length > 30) delete P.sms[ks.sort((a, b) => (P.sms[a].at || 0) - (P.sms[b].at || 0))[0]]; th.at = Date.now(); save(); }
  function sendSms(n, text){ text = text.trim().slice(0, 300); if (!text) return; const id = Math.random().toString(36).slice(2, 10), msg = {me: true, text, t: A.state().time, st: 'Mengirim…'}; addSms(n, msg);
    if (!net.ready) { msg.st = 'Gagal · Multiplayer tidak tersambung'; save(); return; }
    if (!reachable(n)) { msg.st = 'Gagal · nomor tidak aktif'; save(); return; }
    net.pend.set(id, msg); tx({k: 'sms', to: n, text, id}); msg.st = 'Terkirim'; save(); setTimeout(() => { if (net.pend.get(id) === msg) { net.pend.delete(id); } }, 6000); }

  // calls: ring → accept → WebRTC offer/answer/ice → talk → end
  function logCall(n, dir, ok){ P.calls.unshift({n, dir, ok, t: A.state().time}); if (P.calls.length > 30) P.calls.length = 30; save(); }
  function callUI(n, mode){ const old = scr.querySelector('.call'); if (old) old.remove();
    const c = document.createElement('div'); c.className = 'call'; c.style.setProperty('--g', G.telepon);
    c.innerHTML = `<div class="av">${ic('User')}</div><h3>${esc(nameOf(n))}</h3><p class="s"></p><p style="font-size:11.5px;opacity:.6;margin-top:4px">${esc(intl(n))}</p><div class="acts"></div><div class="lbl"></div>`; scr.append(c);
    const acts = c.querySelector('.acts'), lbl = c.querySelector('.lbl'), sEl = c.querySelector('.s');
    const set = (status, buttons) => { sEl.textContent = status; acts.innerHTML = buttons.map(([cls, icn]) => `<button class="${cls}">${ic(icn)}</button>`).join(''); lbl.innerHTML = buttons.map(b => `<span>${b[2]}</span>`).join('');
      buttons.forEach(([, , , fn], i) => acts.children[i].onclick = fn); };
    return {el: c, set, status: t => sEl.textContent = t}; }
  function ringTone(on){ clearInterval(net.ringT); if (on) { A.sfx('ring'); net.ringT = setInterval(() => A.sfx('ring'), 1600); } }
  async function micStream(){ try { return await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}}); } catch (e) { A.toast('Mikrofon tidak diizinkan: lawan bicara tidak mendengar suaramu', 'warn'); return null; } }
  function dial(n){ n = canon(n); if (!n) return;
    if (['133', '110', '118', '14080'].includes(n)) return call(n);
    if (n === P.no) return A.toast('Itu nomormu sendiri', 'warn');
    if (net.call) return A.toast('Masih ada panggilan', 'warn');
    if (!open) toggle(true); lock.classList.add('gone');
    const ui = callUI(n), c = net.call = {n, out: true, ui, st: 'ring'};
    if (!net.ready || !reachable(n)) { ui.set(!net.ready ? 'Multiplayer tidak tersambung' : 'Memanggil…', [['no', 'PhoneOff', 'Tutup', () => endCall(false)]]);
      setTimeout(() => { if (net.call === c) { ui.status('Nomor yang Anda tuju tidak aktif atau berada di luar jangkauan'); logCall(n, 'out', false); setTimeout(() => net.call === c && endCall(false), 2600); } }, 1800); return; }
    ui.set('Memanggil…', [['no', 'PhoneOff', 'Batal', () => { tx({k: 'end', to: n}); endCall(false); }]]); tx({k: 'ring', to: n}); A.sfx('ring');
    c.timeout = setTimeout(() => { if (net.call === c && c.st === 'ring') { tx({k: 'end', to: n}); ui.status('Tidak diangkat'); logCall(n, 'out', false); setTimeout(() => endCall(false), 1500); } }, 30000); }
  function incoming(m){ if (net.call) { tx({k: 'busy', to: m.from}); logCall(m.from, 'in', false); return; }
    if (!open) toggle(true); lock.classList.add('gone'); const n = m.from, ui = callUI(n), c = net.call = {n, out: false, ui, st: 'ring'}; ringTone(true);
    ui.set('Panggilan masuk…', [['no', 'PhoneOff', 'Tolak', () => { tx({k: 'decline', to: n}); logCall(n, 'in', false); endCall(false); }], ['ok', 'Phone', 'Angkat', () => accept(c)]]);
    c.timeout = setTimeout(() => { if (net.call === c && c.st === 'ring') { logCall(n, 'in', false); notify('telepon', 'Panggilan tak terjawab', nameOf(n)); endCall(false); } }, 30000); }
  async function accept(c){ ringTone(false); c.st = 'talk'; c.mic = await micStream(); tx({k: 'accept', to: c.n}); talkUI(c); }
  function talkUI(c){ clearTimeout(c.timeout); c.t0 = Date.now(); const mute = () => { c.muted = !c.muted; if (c.mic) c.mic.getAudioTracks().forEach(t => t.enabled = !c.muted); draw(); };
    const spk = () => { c.loud = !c.loud; if (c.audio) c.audio.volume = c.loud ? 1 : 0.55; draw(); };
    const draw = () => c.ui.set(c.status || '00:00', [['tg2' + (c.muted ? ' on' : ''), c.muted ? 'MicOff' : 'Mic', 'Bisu', mute], ['no', 'PhoneOff', 'Akhiri', () => { tx({k: 'end', to: c.n}); logCall(c.n, c.out ? 'out' : 'in', true); endCall(true); }], ['tg2' + (c.loud ? ' on' : ''), 'Volume2', 'Speaker', spk]]);
    c.loud = true; draw(); clearInterval(c.tick); c.tick = setInterval(() => { const s2 = Math.floor((Date.now() - c.t0)/1000); c.status = `${String(Math.floor(s2/60)).padStart(2, '0')}:${String(s2 % 60).padStart(2, '0')}`; c.ui.status(c.status); }, 1000);
    isl.classList.add('big'); isl.innerHTML = `<span class="dot"></span>${esc(nameOf(c.n))}`; }
  function peer(c){ const pc = c.pc = new RTCPeerConnection({iceServers: A.ICE}); if (window.__phDbg) window.__phDbg.pc = pc;
    pc.onicecandidate = e => { if (e.candidate) tx({k: 'ice', to: c.n, cand: e.candidate.toJSON()}); };
    pc.ontrack = e => { const a = c.audio || (c.audio = new Audio()); a.srcObject = e.streams[0]; a.play().catch(() => {}); };
    if (c.mic) c.mic.getTracks().forEach(t => pc.addTrack(t, c.mic)); else pc.addTransceiver('audio', {direction: 'recvonly'}); return pc; }
  async function callSignal(m){ const c = net.call;
    if (m.k === 'ring') return incoming(m);
    if (!c || c.n !== m.from) return;
    try {
      if (m.k === 'accept' && c.out) { c.st = 'talk'; c.mic = await micStream(); talkUI(c); const pc = peer(c); const o = await pc.createOffer(); await pc.setLocalDescription(o); tx({k: 'offer', to: c.n, sdp: pc.localDescription.toJSON()}); }
      else if (m.k === 'offer') { const pc = c.pc || peer(c); await pc.setRemoteDescription(m.sdp); const an = await pc.createAnswer(); await pc.setLocalDescription(an); tx({k: 'answer', to: c.n, sdp: pc.localDescription.toJSON()}); }
      else if (m.k === 'answer' && c.pc) await c.pc.setRemoteDescription(m.sdp);
      else if (m.k === 'ice' && c.pc) await c.pc.addIceCandidate(m.cand);
      else if (m.k === 'decline' || m.k === 'busy') { c.ui.status(m.k === 'busy' ? 'Sedang sibuk' : 'Panggilan ditolak'); logCall(c.n, 'out', false); setTimeout(() => endCall(false), 1400); }
      else if (m.k === 'end') { if (c.st === 'ring' && !c.out) { logCall(c.n, 'in', false); notify('telepon', 'Panggilan tak terjawab', nameOf(c.n)); } else if (c.st === 'talk') logCall(c.n, c.out ? 'out' : 'in', true); c.ui.status('Panggilan berakhir'); setTimeout(() => endCall(true), 900); }
    } catch (e) {} }
  function endCall(){ const c = net.call; if (!c) return; net.call = null; ringTone(false); clearTimeout(c.timeout); clearInterval(c.tick);
    if (c.pc) { try { c.pc.close(); } catch (e) {} } if (c.mic) c.mic.getTracks().forEach(t => t.stop()); if (c.audio) { c.audio.pause(); c.audio.srcObject = null; }
    isl.classList.remove('big'); isl.innerHTML = ''; const el2 = c.ui.el; el2.style.transition = 'opacity .25s'; el2.style.opacity = '0'; setTimeout(() => el2.remove(), 260); if (cur === 'telepon') redraw(); }

  // Telepon: keypad, recent calls, contacts; service numbers
  let tlTab = 'pad';
  APPS_IMPL.telepon = pg => { scr.style.setProperty('--acc', '#18a33a'); let num = '';
    pg.innerHTML = head('Telepon') + `<div class="myno">Nomormu <b>${fmtNo(P.no)}</b> · ${net.ready ? '<span class="on-dot"></span>online' : 'offline'}</div>`;
    if (!net.ready) { mpOnly(pg); html(pg, `<div class="card" style="margin-top:10px"><h4>Layanan (tetap bisa dihubungi)</h4>${[['133', 'Info Tol', 'derek'], ['110', 'Polisi', 'polisi'], ['118', 'Ambulans', 'amb']].map(([n, l, g]) => `<div class="row" data-n="${n}"><span class="ri" style="--g:${G[g]}">${ic(g === 'polisi' ? 'Shield' : g === 'amb' ? 'Ambulance' : 'Phone')}</span><span class="rt"><b>${l}</b><small>${n}</small></span>${ic('PhoneCall')}</div>`).join('')}</div>`).onclick = e => { const r = e.target.closest('.row'); if (r) call(r.dataset.n); }; return; }
    pg.append(seg([['pad', 'Papan tombol'], ['recent', 'Terbaru'], ['kontak', 'Kontak']], tlTab, k => { tlTab = k; redraw(); }));
    if (tlTab === 'pad') {
      html(pg, `<div><div class="num"></div><div class="pad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', '⌫'].map(d => `<button data-d="${d}">${d}</button>`).join('')}</div>
        <button class="btn dial" style="background:#18a33a;width:66px;height:66px;border-radius:50%;margin:6px auto 14px">${ic('Phone')}</button></div>`);
      html(pg, `<div class="card"><h4>Nomor penting</h4>${[['133', 'Info Tol', 'derek'], ['110', 'Polisi', 'polisi'], ['118', 'Ambulans', 'amb'], ['14080', 'Call center tol', 'derek']].map(([n, l, g]) => `<div class="row" data-n="${n}"><span class="ri" style="--g:${G[g]}">${ic(g === 'polisi' ? 'Shield' : g === 'amb' ? 'Ambulance' : 'Phone')}</span><span class="rt"><b>${l}</b><small>${n}</small></span>${ic('PhoneCall')}</div>`).join('')}</div>`);
      const show = () => pg.querySelector('.num').textContent = /^\d{5,}$/.test(num) && num.startsWith('0') ? fmtNo(num.padEnd(12, ' ').trim()) : num;
      pg.querySelector('.pad').onclick = e => { const d = e.target.dataset.d; if (!d) return; num = d === '⌫' ? num.slice(0, -1) : (num + d).slice(0, 15); show(); A.sfx('key'); };
      pg.querySelector('.dial').onclick = () => num && dial(num);
      pg.querySelectorAll('.row[data-n]').forEach(r => r.onclick = () => call(r.dataset.n));
    } else if (tlTab === 'recent') {
      html(pg, `<div class="card">${P.calls.length ? P.calls.map(c => `<div class="row" data-n="${c.n}"><span class="ri" style="--g:${c.ok ? G.telepon : G.amb}">${ic(c.dir === 'in' ? (c.ok ? 'PhoneIncoming' : 'PhoneMissed') : 'PhoneOutgoing')}</span><span class="rt"><b style="${c.ok ? '' : 'color:#ff5a4f'}">${esc(nameOf(c.n))}</b><small>${c.dir === 'in' ? 'Masuk' : 'Keluar'}${c.ok ? '' : ' · tidak tersambung'}</small></span><span class="rv" style="color:var(--sub);font-weight:600">${c.t}</span></div>`).join('') : '<p>Belum ada panggilan</p>'}</div>`).onclick = e => { const r = e.target.closest('.row'); if (r) dial(r.dataset.n); };
    } else contactList(pg, n => dial(n)); };
  function contactList(pg, onPick, sms){ const list = net.online.concat(Object.keys(P.names).filter(n => !reachable(n)).map(n => ({no: n, name: P.names[n], off: true})));
    html(pg, `<div class="card"><h4>${net.online.length} pemain online</h4>${list.length ? list.map(o => `<div class="row" data-n="${o.no}"><span class="ri" style="--g:${G.kontak}">${ic('User')}</span><span class="rt"><b>${o.off ? '' : '<span class="on-dot"></span>'}${esc(o.name)}</b><small>${fmtNo(o.no)}</small></span>${sms ? ic('MessageCircle') : ic('Phone')}</div>`).join('') : '<p>Belum ada pemain lain yang online. Bagikan nomormu ke teman!</p>'}</div>`).onclick = e => { const r = e.target.closest('.row'); if (r) onPick(r.dataset.n); }; }
  function call(n){ const who = {'133': ['Info Tol 133', G.derek, 'Phone'], '14080': ['Call center tol', G.derek, 'Phone'], '110': ['Polisi 110', G.polisi, 'Shield'], '118': ['Ambulans 118', G.amb, 'Ambulance']}[n] || [n, G.telepon, 'User'];
    const c = document.createElement('div'); c.className = 'call'; c.style.setProperty('--g', who[1]); c.innerHTML = `<div class="av">${ic(who[2])}</div><h3>${esc(who[0])}</h3><p class="s">Memanggil…</p><button class="end" aria-label="Tutup telepon">${ic('PhoneOff')}</button>`;
    scr.append(c); A.sfx('ring'); let t = 0; const iv = setInterval(() => { t++; const s2 = c.querySelector('.s');
      if (t === 2) { s2.textContent = '00:01'; const r = A.callNumber(n); if (r) setTimeout(() => s2.textContent = r, 600); } else if (t > 2 && t < 5) s2.textContent = `00:0${t - 1}`; else if (t >= 6) end(); }, 1000);
    const end = () => { clearInterval(iv); c.style.transition = 'opacity .25s'; c.style.opacity = '0'; setTimeout(() => c.remove(), 260); }; c.querySelector('.end').onclick = end; }

  // Pesan: SMS conversations with other players, and the phone's notifications
  let psTab = 'sms';
  APPS_IMPL.pesan = pg => { scr.style.setProperty('--acc', '#1fae4f');
    pg.innerHTML = head('Pesan') + `<div class="myno">Nomormu <b>${fmtNo(P.no)}</b></div>`;
    pg.append(seg([['sms', 'Percakapan'], ['notif', 'Notifikasi']], psTab, k => { psTab = k; redraw(); }));
    if (psTab === 'notif') { html(pg, `<div class="card">${lastNote.length ? lastNote.map(n => `<div class="row" style="cursor:default"><span class="ri" style="--g:${G[n.k] || G.pesan}">${ic('Bell')}</span><span class="rt"><b>${esc(n.title)}</b><small>${esc(n.body)}</small></span><span class="rv" style="font-weight:600;color:var(--sub)">${n.t}</span></div>`).join('') : '<p>Belum ada notifikasi</p>'}</div>`); return; }
    if (!net.ready) return mpOnly(pg);
    { const l = GRP[GRP.length - 1]; html(pg, `<div class="card row" style="padding:10px 12px" data-g="1"><span class="ri" style="--g:${G.ojek}">${ic('Users')}</span><span class="rt"><b>Grup · Semua pemain (${net.online.length + 1})</b><small>${l ? esc((l.me ? 'Kamu' : l.name) + ': ' + l.text) : 'Ngobrol dengan semua pemain di server'}</small></span>${ic('ChevronRight')}</div>`).onclick = () => groupThread(); }
    html(pg, `<button class="btn">${ic('SquarePen')} Pesan baru</button>`).onclick = () => push(p2 => { p2.innerHTML = head('Pesan baru') + `<div class="srch">${ic('Hash')}<input class="inp" placeholder="Nomor tujuan, mis. 0800-1234-5678" inputmode="tel"></div>`;
      html(p2, `<button class="btn">${ic('ArrowRight')} Lanjut</button>`).onclick = () => { const n = canon(p2.querySelector('input').value); if (!/^0800\d{8}$/.test(n)) return A.toast('Nomor harus 0800-XXXX-XXXX', 'warn'); back(); setTimeout(() => thread(n), 380); };
      contactList(p2, n => { back(); setTimeout(() => thread(n), 380); }, true); });
    const ths = Object.keys(P.sms).sort((a, b) => (P.sms[b].at || 0) - (P.sms[a].at || 0));
    html(pg, `<div class="card">${ths.length ? ths.map(n => { const l = P.sms[n][P.sms[n].length - 1] || {}; return `<div class="row" data-n="${n}"><span class="ri" style="--g:${G.pesan}">${ic('User')}</span><span class="rt"><b>${reachable(n) ? '<span class="on-dot"></span>' : ''}${esc(nameOf(n))}</b><small>${esc((l.me ? 'Kamu: ' : '') + (l.text || ''))}</small></span><span class="rv" style="color:var(--sub);font-weight:600">${l.t || ''}</span></div>`; }).join('') : '<p>Belum ada percakapan. Kirim SMS ke pemain lain lewat nomornya.</p>'}</div>`).onclick = e => { const r = e.target.closest('.row'); if (r) thread(r.dataset.n); }; };
  function groupThread(){ push(pg => { pg.innerHTML = `<div class="ah"><button class="back" data-back>${ic('ChevronLeft')}Pesan</button><h2 style="font-size:16px">Semua pemain<small style="display:block;font-size:10.5px;color:var(--sub);font-weight:600">${net.online.length + 1} online · grup server</small></h2></div>
      <div class="thr">${GRP.map(m => m.sys ? `<p style="text-align:center;font-size:10.5px;color:var(--sub);margin:2px 0">${esc(m.text)}</p>` : `<div class="bub ${m.me ? 'me' : 'them'}">${m.me ? '' : `<b style="font-size:10.5px;display:block;opacity:.8">${esc(m.name)}</b>`}${esc(m.text)}<small>${m.t}</small></div>`).join('')}</div>`;
    const top = stack[stack.length - 1], keep = top.cmp && top.cmp.querySelector('input').value; if (top.cmp) top.cmp.remove();
    const cmp = document.createElement('form'); cmp.className = 'cmp'; cmp.innerHTML = `<input class="inp" placeholder="Pesan ke semua pemain" maxlength="200" autocomplete="off"><button aria-label="Kirim">${ic('Send')}</button>`; app.append(cmp); top.cmp = cmp; if (keep) cmp.querySelector('input').value = keep;
    cmp.onsubmit = e => { e.preventDefault(); const v = cmp.querySelector('input').value.trim(); if (!v) return; if (A.mp.say(v)) { GRP.push({me: true, name: P.owner, text: v, t: A.state().time}); cmp.querySelector('input').value = ''; A.sfx('tap'); redraw(); } };
    requestAnimationFrame(() => pg.scrollTop = pg.scrollHeight); }); }
  function thread(n){ push(pg => { pg.innerHTML = `<div class="ah"><button class="back" data-back>${ic('ChevronLeft')}Pesan</button><h2 style="font-size:16px">${esc(nameOf(n))}<small style="display:block;font-size:10.5px;color:var(--sub);font-weight:600">${fmtNo(n)} · ${reachable(n) ? 'online' : 'offline'}</small></h2><button class="back" data-call>${ic('Phone')}</button></div>
      <div class="thr">${(P.sms[n] || []).map(m => `<div class="bub ${m.me ? 'me' : 'them'}">${esc(m.text)}<small>${m.t}${m.me && m.st ? ' · ' + esc(m.st) : ''}</small></div>`).join('')}</div>`;
    pg.querySelector('[data-call]').onclick = () => dial(n);
    const top = stack[stack.length - 1], keep = top.cmp && top.cmp.querySelector('input').value; if (top.cmp) top.cmp.remove();
    const cmp = document.createElement('form'); cmp.className = 'cmp'; cmp.innerHTML = `<input class="inp" placeholder="SMS" maxlength="300" autocomplete="off"><button aria-label="Kirim">${ic('Send')}</button>`; app.append(cmp); top.cmp = cmp; if (keep) cmp.querySelector('input').value = keep;
    cmp.onsubmit = e => { e.preventDefault(); const v = cmp.querySelector('input').value; if (!v.trim()) return; sendSms(n, v); cmp.querySelector('input').value = ''; A.sfx('tap'); redraw(); };
    requestAnimationFrame(() => pg.scrollTop = pg.scrollHeight); }); }
  APPS_IMPL.kontak = pg => { scr.style.setProperty('--acc', '#5f6773');
    pg.innerHTML = head('Kontak') + `<div class="hero" style="--g:${G.kontak}"><small>Nomormu</small><b>${fmtNo(P.no)}</b><small>${intl(P.no)} · ${esc(P.owner)}</small></div>`;
    if (!net.ready) return mpOnly(pg);
    contactList(pg, n => push(p2 => { p2.innerHTML = head(nameOf(n)) + `<div class="card"><h4>${esc(nameOf(n))}</h4><p>${fmtNo(n)} · ${intl(n)}</p></div>`;
      html(p2, `<button class="btn" style="background:#18a33a">${ic('Phone')} Telepon</button>`).onclick = () => dial(n);
      html(p2, `<button class="btn">${ic('MessageCircle')} Kirim SMS</button>`).onclick = () => { back(); setTimeout(() => thread(n), 380); };
      html(p2, `<div class="card" style="margin-top:10px"><h4>Simpan nama</h4><input class="inp" style="padding-left:12px" maxlength="24" value="${esc(P.names[n] || nameOf(n))}"></div>`).querySelector('input').onchange = e => { P.names[n] = e.target.value.trim().slice(0, 24) || nameOf(n); save(); }; }));
    html(pg, `<button class="btn sec">${ic('UserPlus')} Tambah kontak</button>`).onclick = () => push(p2 => { p2.innerHTML = head('Tambah kontak') + `<div class="card"><input class="inp nm" style="padding-left:12px;margin-bottom:8px" placeholder="Nama" maxlength="24"><input class="inp no" style="padding-left:12px" placeholder="0800-XXXX-XXXX" inputmode="tel"></div>`;
      html(p2, `<button class="btn">${ic('Check')} Simpan</button>`).onclick = () => { const n = canon(p2.querySelector('.no').value), nm = p2.querySelector('.nm').value.trim(); if (!/^0800\d{8}$/.test(n) || !nm) return A.toast('Isi nama dan nomor 0800-XXXX-XXXX', 'warn'); P.names[n] = nm.slice(0, 24); save(); back(); }; }); };
  // Musik: the music player lives here. Search songs (or paste a YouTube / Spotify / SoundCloud link), the results, recently played;
  // the player itself is one element of the game laid over this page, so the song keeps playing when the phone closes
  const mres = document.createElement('div');
  APPS_IMPL.musik = pg => { scr.style.setProperty('--acc', '#e3204d'); const m = A.music.state();
    pg.innerHTML = head('Musik') + `<div class="card mnow ${m.on ? 'on' : ''}"><span class="disc">${ic('Music')}</span><div><b>${esc(m.on ? m.now : 'Belum ada lagu')}</b><small>${m.on ? esc(m.src) + ' · tetap diputar saat HP ditutup' : 'Cari lagu atau tempel link'}</small></div>${m.on ? `<button class="mstop" aria-label="Hentikan">${ic('Square')}</button>` : ''}</div>
      ${m.on ? `<div class="mph" style="height:${m.h}px"></div>` : ''}
      <form class="srch mf" autocomplete="off">${ic('Search')}<input class="inp" placeholder="Cari lagu, atau tempel link YouTube / Spotify…" enterkeyhint="search"></form>`;
    pg.append(mres);
    const rec = A.music.recent(); if (rec.length) html(pg, `<div class="card"><h4>Terakhir diputar</h4>${rec.map((r, i) => `<div class="row" data-i="${i}"><span class="ri" style="--g:${G.musik}">${ic('Music2')}</span><span class="rt"><b>${esc(r.label)}</b><small>${esc(r.item.title)}</small></span><span class="rv">${ic('Play')}</span></div>`).join('')}</div>`)
      .querySelectorAll('.row').forEach(r => r.onclick = () => { A.music.play(+r.dataset.i); A.sfx('tap'); });
    html(pg, `<p class="hint">Lagu dari YouTube, YouTube Music, Spotify, SoundCloud, Apple Music, Deezer atau file audio. Tombol U membuka aplikasi ini.</p>`);
    const f = pg.querySelector('.mf'), inp = f.querySelector('input');
    f.onsubmit = e => { e.preventDefault(); const v = inp.value.trim(); if (!v) return; A.music.submit(v, mres); inp.blur(); A.sfx('tap'); };
    const st = pg.querySelector('.mstop'); if (st) st.onclick = () => { A.music.stop(); A.sfx('tap'); redraw(); }; };
  // lay the game's player over the page's placeholder while the Musik page is on screen, park it off screen otherwise
  function musPos(){ const dock = A.music.dock(); if (dock) {
      const t = stack[stack.length - 1], ph = open && cur === 'musik' && t && !t.pg.classList.contains('out') && t.render === APPS_IMPL.musik ? t.pg.querySelector('.mph') : null;
      if (ph && ph.offsetWidth) { const r = ph.getBoundingClientRect(), sr = scr.getBoundingClientRect(), k = r.width/ph.offsetWidth, top = Math.max(0, sr.top + 46*k - r.top)/k, bot = Math.max(0, r.bottom - sr.bottom + 30*k)/k;
        Object.assign(dock.style, {left: r.left + 'px', top: r.top + 'px', width: ph.offsetWidth + 'px', transform: `scale(${k})`, clipPath: `inset(${top}px 0 ${bot}px 0 round 14px)`, visibility: top + bot >= ph.offsetHeight ? 'hidden' : 'visible'}); }
      else Object.assign(dock.style, {left: '-10000px', top: '0px', transform: 'none', clipPath: 'none', visibility: 'hidden'}); } }
  const musPlace = () => { musPos(); requestAnimationFrame(musPlace); }; requestAnimationFrame(musPlace);
  APPS_IMPL.kamera = pg => { scr.style.setProperty('--acc', '#ffd60a');
    pg.innerHTML = head('Kamera') + `<div class="shot"><canvas></canvas></div><button class="shut" aria-label="Ambil foto"></button><p style="text-align:center;font-size:11.5px;color:var(--sub);margin-top:10px">Foto tersimpan di Galeri</p>`;
    const cv = pg.querySelector('canvas'), ctx = cv.getContext('2d'), f = () => { const src = A.view(); if (!src) return; cv.width = 300; cv.height = 400; const s = Math.max(cv.width/src.width, cv.height/src.height), w = src.width*s, h = src.height*s; ctx.drawImage(src, (cv.width - w)/2, (cv.height - h)/2, w, h); };
    f(); live(f);
    pg.querySelector('.shut').onclick = () => { const url = A.snap(); if (!url) return; gallery.unshift(url); if (gallery.length > 18) gallery.pop(); q('.flash').classList.remove('go'); void q('.flash').offsetWidth; q('.flash').classList.add('go'); A.sfx('shutter'); notify('galeri', 'Foto tersimpan', `${gallery.length} foto di Galeri`); }; };
  APPS_IMPL.galeri = pg => { pg.innerHTML = head('Galeri') + (gallery.length ? `<div class="gal">${gallery.map((u, i) => `<img src="${u}" data-i="${i}" alt="Foto ${i + 1}">`).join('')}</div>` : '<div class="card"><p>Belum ada foto. Buka Kamera untuk memotret jalan.</p></div>');
    pg.onclick = e => { const i = e.target.dataset.i; if (i == null) return; const u = gallery[+i]; push(p2 => { p2.innerHTML = head('Foto') + `<img src="${u}" style="width:100%;border-radius:16px;margin-bottom:8px" alt="Foto">`;
      html(p2, `<button class="btn">${ic('Image')} Jadikan wallpaper</button>`).onclick = () => { P.photoWall = u; look(); A.sfx('ok'); A.toast('Wallpaper HP diganti'); };
      html(p2, `<button class="btn sec">${ic('Download')} Simpan ke perangkat</button>`).onclick = () => { const a = document.createElement('a'); a.href = u; a.download = `driving7mit-${Date.now()}.jpg`; a.click(); };
      html(p2, `<button class="btn red">${ic('Trash2')} Hapus</button>`).onclick = () => { gallery.splice(+i, 1); back(); }; }); }; };

  // Cuaca: weather and the time of day
  APPS_IMPL.cuaca = pg => { scr.style.setProperty('--acc', '#2a6fd8'); const s = A.state();
    const W = {cerah: ['Cerah', 'Sun'], berawan: ['Berawan', 'Cloud'], hujan: ['Hujan', 'CloudRain'], kabut: ['Kabut', 'CloudFog']};
    pg.innerHTML = head('Cuaca') + `<div class="hero" style="--g:${G.cuaca}"><small>${esc(s.place)}</small><b style="font-size:46px;font-weight:300">${s.temp}°</b><small>${W[s.weather] ? W[s.weather][0] : s.weather} · ${s.time}</small></div>`;
    html(pg, `<div class="card"><h4>Ubah cuaca</h4><div class="vg">${Object.entries(W).map(([k, [l, i]]) => `<button data-w="${k}" class="${k === s.weather ? 'on' : ''}">${ic(i)}${l}</button>`).join('')}</div></div>`).onclick = e => { const b = e.target.closest('button'); if (!b) return; A.setWeather(b.dataset.w); A.sfx('tap'); setTimeout(redraw, 50); };
    html(pg, `<div class="card"><h4>Atur jam</h4><div class="vg">${[['morning', 'Pagi', 'Sunrise'], ['day', 'Siang', 'Sun'], ['dusk', 'Sore', 'Sunset'], ['night', 'Malam', 'Moon']].map(([k, l, i]) => `<button data-t="${k}">${ic(i)}${l}</button>`).join('')}</div></div>`).onclick = e => { const b = e.target.closest('button'); if (!b) return; A.setTod(b.dataset.t); A.sfx('tap'); setTimeout(redraw, 50); }; };

  // Pengaturan: customise the phone
  APPS_IMPL.setelan = pg => { scr.style.setProperty('--acc', P.acc);
    pg.innerHTML = head('Pengaturan') + `<div class="card"><h4>Wallpaper</h4><div class="walls">${Object.keys(WALLS).map(k => `<button style="--w:${WALLS[k]}" data-w="${k}" class="${k === P.wall && !P.photoWall ? 'on' : ''}" title="${WALL_NAME[k]}"></button>`).join('')}</div></div>
      <div class="card"><h4>Warna casing</h4><div class="sw cs">${CASES.map(c => `<button style="--c:${c}" data-c="${c}" class="${c === P.case ? 'on' : ''}"></button>`).join('')}</div></div>
      <div class="card"><h4>Warna aksen</h4><div class="sw ac">${ACCS.map(c => `<button style="--c:${c}" data-c="${c}" class="${c === P.acc ? 'on' : ''}"></button>`).join('')}</div></div>
      <div class="card"><h4>Tampilan</h4></div><div class="card"><h4>Bentuk ikon</h4></div>
      <div class="card"><h4>Nama di layar kunci</h4><input class="inp ow" style="padding-left:12px" maxlength="24" value="${esc(P.owner)}"></div>
      <div class="card"><div class="tg">Peringatan main HP saat menyetir<i class="wn ${P.warn ? 'on' : ''}"></i></div></div>
      <div class="card"><h4>Nomor HP</h4><p><b style="color:var(--ink);font-size:14px">${fmtNo(P.no)}</b> · ${intl(P.no)}</p><button class="btn sec nn" style="margin-top:8px">${ic('RefreshCw')} Ganti nomor</button></div>`;
    const cards = pg.querySelectorAll('.card');
    cards[3].append(seg([['dark', 'Gelap'], ['light', 'Terang']], P.theme, k => { P.theme = k; look(); save(); }));
    cards[4].append(seg([['26', 'Bulat'], ['15', 'Rounded'], ['6', 'Kotak']], String(P.shape), k => { P.shape = +k; look(); save(); }));
    pg.onclick = e => { const t = e.target;
      if (t.dataset.w) { P.wall = t.dataset.w; P.photoWall = null; } else if (t.closest('.cs')) P.case = t.dataset.c || P.case; else if (t.closest('.ac')) P.acc = t.dataset.c || P.acc;
      else if (t.classList.contains('wn')) P.warn = !P.warn;
      else if (t.closest('.nn')) { P.no = '0800' + String(Math.floor(1e7 + Math.random()*9e7)); A.toast('Nomor baru: ' + fmtNo(P.no)); }
      else return; look(); save(); A.sfx('tap'); redraw(); };
    pg.querySelector('.ow').onchange = e => { P.owner = e.target.value.trim() || 'Pengemudi 7MIT'; save(); };
    // where the roads come from: OpenStreetMap, live
    const O = A.osm.S(), ost = {idle: 'Menunggu', loading: 'Sedang memuat…', ok: `Aktif · ${O.n.toLocaleString('id-ID')} ruas · ${Math.round(O.km).toLocaleString('id-ID')} km${O.source ? ' · ' + O.source : ''}`, fail: `Gagal (${O.err}) · memakai data bawaan`}[O.status];
    html(pg, `<div class="card"><h4>Data jalan</h4><p>OpenStreetMap (diambil langsung dari internet, disimpan di perangkat)<br><b style="color:var(--ink)">${esc(ost)}</b></p><button class="btn sec osr" style="margin-top:8px">${ic('RefreshCw')} Muat ulang data jalan</button><p style="margin-top:6px;font-size:10.5px">Data peta © kontributor OpenStreetMap (ODbL)</p></div>`)
      .querySelector('.osr').onclick = e => { e.stopPropagation(); A.osm.reload(); A.toast('Memuat ulang data jalan dari OpenStreetMap…'); setTimeout(redraw, 300); };
    live(() => { if (A.osm.S().status !== O.status) redraw(); });
    html(pg, `<button class="btn sec">${ic('SlidersHorizontal')} Pengaturan game</button>`).onclick = () => { toggle(false); A.openSettings(); }; };

  look(); drawHome();
  const peersChanged = () => { if (cur === 'kontak' || cur === 'pesan' || cur === 'telepon') redraw(); };
  return {musicChanged: () => { if (cur === 'musik') redraw(); }, toggle, notify, tick, netIn: onNet, groupIn, peersChanged, get number(){ return P.no; }, openGroup: () => { if (!open) toggle(true); lock.classList.add('gone'); drawHome(); openApp('pesan'); setTimeout(() => net.ready && groupThread(), 450); }, get open(){ return open; }, openApp: k => { if (!open) toggle(true); unlock(); setTimeout(() => openApp(k, home.querySelector(`[data-app="${k}"]`)), 350); }};
}
