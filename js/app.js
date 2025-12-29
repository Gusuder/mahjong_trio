"use strict";

const ICONS=[
  {key:"apple",code:"1f34e",emoji:"🍎"},
  {key:"lemon",code:"1f34b",emoji:"🍋"},
  {key:"grapes",code:"1f347",emoji:"🍇"},
  {key:"cherries",code:"1f352",emoji:"🍒"},
  {key:"kiwi",code:"1f95d",emoji:"🥝"},
  {key:"peach",code:"1f351",emoji:"🍑"},
  {key:"watermelon",code:"1f349",emoji:"🍉"},
  {key:"strawberry",code:"1f353",emoji:"🍓"},
  {key:"pineapple",code:"1f34d",emoji:"🍍"},
  {key:"tangerine",code:"1f34a",emoji:"🍊"},
  {key:"coconut",code:"1f965",emoji:"🥥"},
  {key:"pear",code:"1f350",emoji:"🍐"},
  {key:"banana",code:"1f34c",emoji:"🍌"},
  {key:"blueberries",code:"1fad0",emoji:"🫐"},
  {key:"carrot",code:"1f955",emoji:"🥕"},
  {key:"cookie",code:"1f36a",emoji:"🍪"}
];
const ICON_BY_KEY=new Map(ICONS.map(x=>[x.key,x]));

const TRAY_SIZE=7;
const STATE_KEY="tile_game_state_v4";
const STATS_KEY="tile_game_stats_v1";

const UI={
  board:document.getElementById("board"),
  traySlots:document.getElementById("traySlots"),
  status:document.getElementById("status"),
  moves:document.getElementById("txtMoves"),
  left:document.getElementById("txtLeft"),
  tray:document.getElementById("txtTray"),
  btnNew:document.getElementById("btnNew"),
  btnUndo:document.getElementById("btnUndo"),
  btnMenu:document.getElementById("btnMenu"),
  menuModal:document.getElementById("menuModal"),
  btnMenuClose:document.getElementById("btnMenuClose"),
  btnShuffle:document.getElementById("btnShuffle"),
  btnDifficulty:document.getElementById("btnDifficulty"),
  btnStatsReset:document.getElementById("btnStatsReset")
};

let difficulty=1;
let tiles=[];
let tray=[];
let history=[];
let moves=0;
let isOver=false;
let inputLocked=false;

let cfg=null;
let layoutKey="";

let clickablesCache=[];
let gameStartTs=0;
let stats=loadStats();

/* ===== Utilities ===== */
function randInt(min,max){return Math.floor(Math.random()*(max-min+1))+min}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function shuffle(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=arr[i];arr[i]=arr[j];arr[j]=t}return arr}
function deepCopy(x){if(typeof structuredClone==="function")return structuredClone(x);return JSON.parse(JSON.stringify(x))}
function isMobile(){return window.matchMedia("(max-width:520px)").matches}
function desiredTilePx(){const v=getComputedStyle(document.documentElement).getPropertyValue("--tile").trim();const n=parseInt(v.replace("px",""),10);return Number.isFinite(n)?n:56}
function vib(ms){if(navigator&&typeof navigator.vibrate==="function")navigator.vibrate(ms)}

function setStatus(html){UI.status.innerHTML=html}
function updateInfo(){UI.moves.textContent=String(moves);UI.left.textContent=String(tiles.length);UI.tray.textContent=`${tray.length}/${TRAY_SIZE}`}
function makeTraySlots(){UI.traySlots.innerHTML="";for(let i=0;i<TRAY_SIZE;i++){const d=document.createElement("div");d.className="traySlot";UI.traySlots.appendChild(d)}}

/* ===== Stats ===== */
function saveStats(){localStorage.setItem(STATS_KEY,JSON.stringify(stats))}
function loadStats(){
  const raw=localStorage.getItem(STATS_KEY);
  if(!raw)return{games:0,wins:0,losses:0,streak:0,bestStreak:0,winTimeMs:0};
  try{
    const s=JSON.parse(raw);
    return{games:s.games||0,wins:s.wins||0,losses:s.losses||0,streak:s.streak||0,bestStreak:s.bestStreak||0,winTimeMs:s.winTimeMs||0};
  }catch(e){
    return{games:0,wins:0,losses:0,streak:0,bestStreak:0,winTimeMs:0};
  }
}
function statsLine(){
  const games=stats.games;
  const wins=stats.wins;
  const rate=games?Math.round((wins/games)*100):0;
  const avg=stats.wins?Math.round(stats.winTimeMs/stats.wins/1000):0;
  return `Статистика: победы ${wins}/${games} (${rate}%), серия ${stats.streak} (лучше ${stats.bestStreak}), среднее время победы ${avg}с`;
}

/* ===== Persistence ===== */
function saveState(){
  const state={v:4,difficulty:difficulty,tiles:tiles,tray:tray,moves:moves,isOver:isOver,cfg:cfg,gameStartTs:gameStartTs,stats:stats};
  localStorage.setItem(STATE_KEY,JSON.stringify(state));
}
function loadState(){
  const raw=localStorage.getItem(STATE_KEY);
  if(!raw)return null;
  try{
    const s=JSON.parse(raw);
    if(!s||s.v!==4)return null;
    return s;
  }catch(e){
    return null;
  }
}
function snapshot(){return{tiles:deepCopy(tiles),tray:deepCopy(tray),moves:moves,isOver:isOver,cfg:deepCopy(cfg),gameStartTs:gameStartTs}}
function restore(s){tiles=s.tiles;tray=s.tray;moves=s.moves;isOver=s.isOver;cfg=s.cfg;gameStartTs=s.gameStartTs||Date.now()}

/* ===== Icons ===== */
function preloadIcons(){
  const tasks=[];
  for(const meta of ICONS){
    const img=new Image();
    img.decoding="async";
    const p=new Promise(resolve=>{img.onload=()=>resolve();img.onerror=()=>resolve();});
    img.src=`assets/icons/${meta.code}.svg`;
    tasks.push(p);
  }
  return Promise.all(tasks);
}
function createIconImg(meta,className){
  const img=document.createElement("img");
  img.className=className;
  img.alt=meta.key;
  img.decoding="async";
  img.loading="eager";
  img.src=`assets/icons/${meta.code}.svg`;
  img.onerror=()=>{img.replaceWith(document.createTextNode(meta.emoji||""))};
  return img;
}
function renderTray(){
  const slots=[...UI.traySlots.children];
  for(let i=0;i<TRAY_SIZE;i++){
    const slot=slots[i];
    slot.innerHTML="";
    const key=tray[i]?tray[i].key:null;
    if(!key)continue;
    const meta=ICON_BY_KEY.get(key);
    if(!meta){slot.textContent="";continue}
    slot.appendChild(createIconImg(meta,"traySlotIcon"));
  }
}

/* ===== Modal Menu ===== */
function openMenu(){
  if(!UI.menuModal)return;
  UI.menuModal.classList.add("open");
  UI.menuModal.setAttribute("aria-hidden","false");
}
function closeMenu(){
  if(!UI.menuModal)return;
  UI.menuModal.classList.remove("open");
  UI.menuModal.setAttribute("aria-hidden","true");
}
function setupMenuModal(){
  if(!UI.btnMenu||!UI.menuModal)return;
  UI.btnMenu.addEventListener("pointerdown",(e)=>{e.preventDefault();openMenu();},{passive:false});
  UI.btnMenu.addEventListener("click",(e)=>{e.preventDefault();openMenu();});
  if(UI.btnMenuClose)UI.btnMenuClose.addEventListener("click",()=>closeMenu());
  UI.menuModal.addEventListener("click",(e)=>{const t=e.target;if(t&&t.dataset&&t.dataset.close==="1")closeMenu();});
  document.addEventListener("keydown",(e)=>{if(e.key==="Escape")closeMenu();});

  if(UI.btnShuffle)UI.btnShuffle.addEventListener("click",()=>closeMenu());
  if(UI.btnDifficulty)UI.btnDifficulty.addEventListener("click",()=>closeMenu());

  if(UI.btnStatsReset){
    UI.btnStatsReset.addEventListener("click",()=>{
      localStorage.removeItem(STATS_KEY);
      localStorage.removeItem(STATE_KEY);
      stats=loadStats();
      saveStats();
      closeMenu();
      newGame();
    });
  }
}

/* ===== Gameplay helpers ===== */
function topLayerMap(list){
  const map=new Map();
  for(let i=0;i<list.length;i++){
    const t=list[i];
    const key=`${t.x}|${t.y}`;
    const cur=map.get(key);
    if(cur==null||t.layer>cur.layer)map.set(key,{layer:t.layer,idx:i});
  }
  return map;
}
function isClickableByTop(tile,top){
  const v=top.get(`${tile.x}|${tile.y}`);
  return v&&v.layer===tile.layer;
}

/* ===== Guaranteed solvability via reverse generation ===== */
function chooseCfg(){
  const mobile=isMobile();
  const boxW=UI.board.clientWidth;
  const boxH=UI.board.clientHeight;
  const desired=desiredTilePx();

  const padX=14;
  const padTop=34;
  const padBottom=12;
  const gap=8;

  const minTile=mobile?40:34;

  const candidates=mobile
    ?[{cols:7,rows:6},{cols:8,rows:6},{cols:8,rows:7},{cols:9,rows:7}]
    :[{cols:10,rows:7},{cols:11,rows:7},{cols:12,rows:8}];

  let best=null;
  for(const c of candidates){
    const maxW=Math.floor((boxW-padX*2-(c.cols-1)*gap)/c.cols);
    const maxH=Math.floor((boxH-padTop-padBottom-(c.rows-1)*gap)/c.rows);
    const tile=Math.min(desired,maxW,maxH);
    if(tile<minTile)continue;
    const score=tile*100000+(c.cols*c.rows);
    if(!best||score>best.score)best={score:score,cols:c.cols,rows:c.rows};
  }
  if(!best)best=mobile?{cols:7,rows:6}:{cols:10,rows:7};

  const tileSize=Math.min(
    desired,
    Math.floor((boxW-padX*2-(best.cols-1)*gap)/best.cols),
    Math.floor((boxH-padTop-padBottom-(best.rows-1)*gap)/best.rows)
  );

  const maxLayer=clamp((mobile?5:6)+(difficulty===2?1:0),4,7);
  const dx=Math.max(3,Math.round(tileSize*0.12));
  const dy=Math.max(2,Math.round(tileSize*0.10));

  const baseTiles=best.cols*best.rows*clamp(maxLayer-1,3,6);
  let targetTiles=Math.max(120,Math.round(baseTiles*(mobile?0.62:0.70)));
  targetTiles=targetTiles-(targetTiles%3);

  const typesCount=clamp(Math.round(targetTiles/12),8,12);

  return{
    cols:best.cols,rows:best.rows,gap:gap,padX:padX,padTop:padTop,padBottom:padBottom,
    tileSize:tileSize,dx:dx,dy:dy,maxLayer:maxLayer,
    targetTiles:targetTiles,typesCount:typesCount
  };
}
function layoutKeyOf(c){return `${c.cols}x${c.rows}|L${c.maxLayer}|D${difficulty}|M${isMobile()?1:0}`}

function simulateTrayAdd(trayArr,key){
  const next=trayArr.slice();
  next.push(key);
  let changed=true;
  while(changed){
    changed=false;
    const map=new Map();
    for(let i=0;i<next.length;i++){
      const s=next[i];
      const idxs=map.get(s)||[];
      idxs.push(i);
      map.set(s,idxs);
    }
    for(const [sym,idxs] of map.entries()){
      if(idxs.length>=3){
        const three=idxs.slice(0,3).sort((a,b)=>b-a);
        for(const idx of three)next.splice(idx,1);
        changed=true;
        break;
      }
    }
  }
  return next;
}
function buildSafeSolutionKeys(keysBag){
  const remaining=new Map();
  for(const k of keysBag)remaining.set(k,(remaining.get(k)||0)+1);
  const solution=[];
  let traySim=[];
  let guard=0;
  while(solution.length<keysBag.length && guard<200000){
    guard++;
    const candidates=[];
    for(const [k,cnt] of remaining.entries()){
      if(cnt<=0)continue;
      let inTray=0;
      for(const t of traySim)if(t===k)inTray++;
      candidates.push({k:k,cnt:cnt,inTray:inTray});
    }
    candidates.sort((a,b)=>{
      if(b.inTray!==a.inTray)return b.inTray-a.inTray;
      return b.cnt-a.cnt;
    });
    let picked=null;
    for(const cand of candidates){
      const nextTray=simulateTrayAdd(traySim,cand.k);
      if(nextTray.length<TRAY_SIZE){picked=cand.k;traySim=nextTray;break;}
      if(nextTray.length===TRAY_SIZE-1){picked=cand.k;traySim=nextTray;break;}
    }
    if(!picked)return null;
    solution.push(picked);
    remaining.set(picked,remaining.get(picked)-1);
    if(remaining.get(picked)===0)remaining.delete(picked);
  }
  if(solution.length!==keysBag.length)return null;
  return solution;
}
function pickPlayableCells(c){
  const cells=[];
  const cx=(c.cols-1)/2;
  const cy=(c.rows-1)/2;
  for(let y=0;y<c.rows;y++){
    for(let x=0;x<c.cols;x++){
      const dx=x-cx;
      const dy=y-cy;
      const dist=Math.sqrt(dx*dx+dy*dy);
      const maxDist=Math.max(c.cols,c.rows)*0.62;
      if(dist<=maxDist || Math.random()<0.15)cells.push({x:x,y:y,dist:dist});
    }
  }
  cells.sort((a,b)=>a.dist-b.dist);
  return cells;
}
function buildBoardFromSolution(c,solutionKeys){
  const cells=pickPlayableCells(c);
  const heights=new Map();
  const getH=(x,y)=>heights.get(`${x}|${y}`)||0;
  const incH=(x,y)=>heights.set(`${x}|${y}`,getH(x,y)+1);
  const placed=[];
  function pickCell(){
    const best=[];
    for(const cell of cells){
      const h=getH(cell.x,cell.y);
      if(h>=c.maxLayer)continue;
      best.push({cell:cell,h:h});
    }
    best.sort((a,b)=>a.h-b.h);
    const pool=best.slice(0,Math.min(14,best.length));
    if(pool.length===0){
      heights.clear();
      return cells[0];
    }
    return pool[Math.floor(Math.random()*pool.length)].cell;
  }
  for(let i=solutionKeys.length-1;i>=0;i--){
    const key=solutionKeys[i];
    const cell=pickCell();
    const layer=getH(cell.x,cell.y);
    incH(cell.x,cell.y);
    placed.push({id:`t${i}`,key:key,x:cell.x,y:cell.y,layer:layer,dx:layer*c.dx,dy:layer*c.dy});
  }
  return placed;
}
function generateGuaranteedLevel(){
  cfg=chooseCfg();
  layoutKey=layoutKeyOf(cfg);
  const keys=ICONS.slice(0,cfg.typesCount).map(x=>x.key);
  const tripleCount=cfg.targetTiles/3;
  const base=Math.floor(tripleCount/keys.length);
  const rem=tripleCount-(base*keys.length);
  const bag=[];
  for(let i=0;i<keys.length;i++){
    const k=base+(i<rem?1:0);
    for(let j=0;j<k*3;j++)bag.push(keys[i]);
  }
  shuffle(bag);
  let solution=null;
  for(let attempt=0;attempt<20;attempt++){
    solution=buildSafeSolutionKeys(bag);
    if(solution)break;
    shuffle(bag);
  }
  if(!solution)solution=bag.slice();
  tiles=buildBoardFromSolution(cfg,solution);
}

/* ===== Rendering ===== */
function renderBoard(){
  UI.board.querySelectorAll(".tile").forEach(n=>n.remove());
  const c=cfg||chooseCfg();
  const boxW=UI.board.clientWidth;
  const boxH=UI.board.clientHeight;
  const size=Math.min(
    desiredTilePx(),
    Math.floor((boxW-c.padX*2-(c.cols-1)*c.gap)/c.cols),
    Math.floor((boxH-c.padTop-c.padBottom-(c.rows-1)*c.gap)/c.rows)
  );
  const fieldW=c.cols*(size+c.gap)-c.gap;
  const startX=Math.max(c.padX,Math.floor((boxW-fieldW)/2));
  const startY=c.padTop;
  const top=topLayerMap(tiles);
  clickablesCache=[];
  for(const t of tiles){
    const d=document.createElement("div");
    d.className="tile";
    d.dataset.id=t.id;
    d.style.width=size+"px";
    d.style.height=size+"px";
    d.style.left=`${startX+t.x*(size+c.gap)+t.dx}px`;
    d.style.top=`${startY+t.y*(size+c.gap)+t.dy}px`;
    d.style.zIndex=String(100+t.layer*100+t.y*2+t.x);

    const hue=((ICONS.findIndex(x=>x.key===t.key))*37)%360;
    const r=Math.max(10,Math.round(size*0.22));
    const pipSize=Math.max(7,Math.round(size*0.20));
    const pipOffset=Math.max(6,Math.round(size*0.18));
    d.style.setProperty("--hue",String(hue));
    d.style.setProperty("--r",r+"px");
    d.style.setProperty("--pipSize",pipSize+"px");
    d.style.setProperty("--pipOffset",pipOffset+"px");

    const pip=document.createElement("span");
    pip.className="tilePip";

    const iconWrap=document.createElement("span");
    iconWrap.className="tileIcon";
    const meta=ICON_BY_KEY.get(t.key);
    if(meta)iconWrap.appendChild(createIconImg(meta,""));

    d.appendChild(pip);
    d.appendChild(iconWrap);

    const clickable=isClickableByTop(t,top);
    if(!clickable)d.classList.add("blocked");
    else{
      const cx=parseFloat(d.style.left)+size/2;
      const cy=parseFloat(d.style.top)+size/2;
      clickablesCache.push({id:t.id,cx:cx,cy:cy,size:size});
    }
    UI.board.appendChild(d);
  }
  renderTray();
  updateInfo();
  if(!isOver)setStatus(`<div style="opacity:.85">${statsLine()}</div>`);
}

/* ===== Game logic ===== */
function removeTriples(){
  let removed=0;
  let changed=true;
  while(changed){
    changed=false;
    const map=new Map();
    for(let i=0;i<tray.length;i++){
      const s=tray[i].key;
      const idxs=map.get(s)||[];
      idxs.push(i);
      map.set(s,idxs);
    }
    for(const [sym,idxs] of map.entries()){
      if(idxs.length>=3){
        const three=idxs.slice(0,3).sort((a,b)=>b-a);
        for(const idx of three)tray.splice(idx,1);
        removed++;
        changed=true;
        break;
      }
    }
  }
  return removed;
}
function finishWin(){
  isOver=true;
  const dt=Math.max(0,Date.now()-gameStartTs);
  stats.wins++;
  stats.games++;
  stats.streak++;
  stats.bestStreak=Math.max(stats.bestStreak,stats.streak);
  stats.winTimeMs+=dt;
  saveStats();
  setStatus(`<span class="win">Победа!</span> Поле очищено за <b>${moves}</b> ход(ов). Время: <b>${Math.round(dt/1000)}с</b><div style="margin-top:6px;opacity:.85">${statsLine()}</div>`);
  vib(60);
  saveState();
}
function finishLose(){
  isOver=true;
  stats.losses++;
  stats.games++;
  stats.streak=0;
  saveStats();
  setStatus(`<span class="lose">Поражение!</span> Лоток переполнен.<div style="margin-top:6px;opacity:.85">${statsLine()}</div>`);
  vib(80);
  saveState();
}
function checkEnd(){
  if(tiles.length===0){finishWin();return;}
  if(tray.length>=TRAY_SIZE){finishLose();return;}
}
function animateFlyToTray(tileId,targetIndex){
  const tileEl=UI.board.querySelector(`.tile[data-id="${tileId}"]`);
  const slotEl=UI.traySlots.children[targetIndex]||UI.traySlots.children[TRAY_SIZE-1];
  if(!tileEl||!slotEl)return Promise.resolve();
  const from=tileEl.getBoundingClientRect();
  const to=slotEl.getBoundingClientRect();
  const ghost=tileEl.cloneNode(true);
  ghost.classList.remove("blocked");
  ghost.style.position="fixed";
  ghost.style.left=from.left+"px";
  ghost.style.top=from.top+"px";
  ghost.style.width=from.width+"px";
  ghost.style.height=from.height+"px";
  ghost.style.margin="0";
  ghost.style.zIndex="9999";
  ghost.style.pointerEvents="none";
  document.body.appendChild(ghost);
  tileEl.style.visibility="hidden";
  const dx=(to.left+to.width/2)-(from.left+from.width/2);
  const dy=(to.top+to.height/2)-(from.top+from.height/2);
  const anim=ghost.animate(
    [{transform:"translate(0px,0px) scale(1)",opacity:1},{transform:`translate(${dx}px,${dy}px) scale(.88)`,opacity:.98}],
    {duration:220,easing:"cubic-bezier(.2,.8,.2,1)",fill:"forwards"}
  );
  return anim.finished.catch(()=>{}).finally(()=>{ghost.remove();tileEl.style.visibility="";});
}
async function onTileClick(id){
  if(isOver||inputLocked)return;
  const top=topLayerMap(tiles);
  const t=tiles.find(x=>x.id===id);
  if(!t)return;
  if(!isClickableByTop(t,top))return;
  if(tray.length>=TRAY_SIZE){checkEnd();return;}
  inputLocked=true;
  vib(8);
  const targetIndex=tray.length;
  await animateFlyToTray(id,targetIndex);
  history.push(snapshot());
  tiles=tiles.filter(x=>x.id!==id);
  tray.push({key:t.key,id:t.id});
  moves++;
  const removed=removeTriples();
  if(removed>0)vib(22);
  renderBoard();
  checkEnd();
  inputLocked=false;
  saveState();
}
function undo(){
  if(history.length===0||isOver)return;
  const s=history.pop();
  restore(s);
  setStatus(`<div style="opacity:.85">${statsLine()}</div>`);
  renderBoard();
  saveState();
}
function shuffleTiles(){
  if(isOver)return;
  history.push(snapshot());
  const keys=tiles.map(t=>t.key);
  shuffle(keys);
  tiles=tiles.map((t,i)=>({id:t.id,key:keys[i],x:t.x,y:t.y,layer:t.layer,dx:t.dx,dy:t.dy}));
  renderBoard();
  saveState();
}
function toggleDifficulty(){
  difficulty=difficulty===1?2:1;
  UI.btnDifficulty.textContent=difficulty===1?"Сложнее":"Полегче";
  newGame();
}
function newGame(){
  isOver=false;
  moves=0;
  history=[];
  tray=[];
  gameStartTs=Date.now();
  generateGuaranteedLevel();
  setStatus(`<div style="opacity:.85">${statsLine()}</div>`);
  renderBoard();
  checkEnd();
  saveState();
}
function handleResize(){
  const newCfg=chooseCfg();
  const newKey=layoutKeyOf(newCfg);
  if(newKey!==layoutKey){newGame();return;}
  cfg=newCfg;
  renderBoard();
  saveState();
}

/* ===== Big hitbox + magnet ===== */
function findNearestClickable(clientX,clientY){
  if(clickablesCache.length===0)return null;
  let best=null;
  let bestD=Infinity;
  for(const c of clickablesCache){
    const dx=clientX-c.cx;
    const dy=clientY-c.cy;
    const d=dx*dx+dy*dy;
    if(d<bestD){bestD=d;best=c;}
  }
  if(!best)return null;
  const r=Math.max(26,best.size*0.75);
  if(bestD<=r*r)return best.id;
  return null;
}
function onBoardPointerDown(e){
  if(isOver||inputLocked)return;
  const target=e.target;
  const tileEl=target&&target.closest?target.closest(".tile"):null;
  if(tileEl&&tileEl.dataset&&tileEl.dataset.id){
    onTileClick(tileEl.dataset.id);
    return;
  }
  const id=findNearestClickable(e.clientX,e.clientY);
  if(id)onTileClick(id);
}

/* ===== Wire up ===== */
UI.btnNew.addEventListener("click",()=>newGame());
UI.btnUndo.addEventListener("click",()=>undo());
UI.btnShuffle.addEventListener("click",()=>{shuffleTiles();closeMenu();});
UI.btnDifficulty.addEventListener("click",()=>{toggleDifficulty();closeMenu();});
UI.board.addEventListener("pointerdown",onBoardPointerDown,{passive:true});
window.addEventListener("resize",()=>handleResize());
window.addEventListener("orientationchange",()=>setTimeout(()=>handleResize(),80));

(function init(){
  setupMenuModal();
  makeTraySlots();
  preloadIcons().finally(()=>{
    const saved=loadState();
    if(saved&&saved.stats){stats=saved.stats;saveStats();}
    if(saved&&saved.tiles&&saved.tray&&saved.cfg){
      difficulty=saved.difficulty||1;
      UI.btnDifficulty.textContent=difficulty===1?"Сложнее":"Полегче";
      restore(saved);
      cfg=saved.cfg;
      layoutKey=layoutKeyOf(cfg);
      renderBoard();
      if(!isOver)checkEnd();
      return;
    }
    newGame();
  });
})();
