
(() => {
  "use strict";

  const canvas = document.getElementById("race");
  const ctx = canvas.getContext("2d");
  const rankingEl = document.getElementById("rankingList");
  const focusModeBtn = document.getElementById("focusModeBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const povSelect = document.getElementById("povSelect");
  let povPlayerIndex=-1;
  const layoutEl = document.querySelector(".layout");
  const broadcastEl = document.querySelector(".broadcast");

  const diagToggle=document.getElementById("diagToggle");
  const diagnostics=document.getElementById("diagnostics");
  const clockEl = document.getElementById("clock");
  const cameraLabel = document.getElementById("cameraLabel");
  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");
  const mapSelect774 = document.getElementById("mapSelect774");
  const mapSelectIcon774 = document.getElementById("mapSelectIcon774");

  let MAP_W = 172, MAP_H = 178;
  const OBSERVER_COUNT=200; // allocation/fallback ceiling only; actual per-map spawn uses observerCountForMap791()
  function observerCountForMap791(m=currentMap770()){
    if(!m)return 100;
    const id=String(m.id||"").toLowerCase();
    if(id==="double_hairpin")return 150;  // Three-Leaf Clover
    if(id==="cliff_hanger")return 100;    // 스카이클리프
    if(id==="skyway")return 130;          // 스페이스
    if(id==="s_map")return 100;           // 네온드리프트
    if(id==="star_fish")return 180;
    if(id==="triple_diamond")return 180;  // 데스티니게이트
    if(id==="ice_ring")return 200;
    if(id==="neon_city")return 200;       // 하트
    if(id==="desert_oasis")return 200;
    return 100;
  }

  const HIT_CHANCE = 1.00;
  const STUN_MS = 0;
  const INV_MS = 0;
  const CAMERA_ZOOM = 3.00;
  const BUILD_ID = "v1.70.0";
window.__OBSERVER_FM_BUILD__ = BUILD_ID;

  const RACER_KEYS=["A","B","C","D","E","F","G","H"];
  const unitSprites={};
  const unitFiles={1:"scourge",2:"scout",3:"wraith",4:"mutalisk",5:"queen"};
  for(let r=1;r<=5;r++){
    unitSprites[r]={};
    RACER_KEYS.forEach((key,i)=>{
      const img=new Image(); img.src=`${unitFiles[r]}_${String.fromCharCode(97+i)}.png`; unitSprites[r][key]=img;
    });
  }
  // Engine safeguards. Visual sprite size is independent of collision radius.
  const PLAYER_HIT_RADIUS = 0.56;     // v4.07: smaller racer sprite, collision tuned down accordingly
  const PLAYER_VISUAL_SCALE = 0.6583842;  // v4.07: additional -10% from v4.04
  const OBS_VISUAL_SCALE = 0.851598;     // v4.03: +15%
  const OBS_SPEED_RATIO = 0.604314;         // observer speed ≈ 90% of player speed
  const OBS_WANDER_RANGE = 0.88;        // legacy value (not used for full-map roam)
  const OBS_MOVE_MS = 10000;            // move for 10 seconds
  const OBS_STOP_MS = 1000;             // then stop for 1 second
  const AVOID_SCAN_RADIUS = 39.0;        // look ahead for nearby observers
  const AVOID_CRITICAL_RADIUS = 10.8;     // emergency reaction zone
  const AVOID_PREDICT_SEC = 4.10;        // predict observer positions ahead
  const AVOID_REACTION_CHANCE = 0.9995;  // much stronger reaction rate
  const AVOID_SAFE_BUFFER = 7.6;
  const AVOID_LANE_LOOKAHEAD = 3.05;
  const AVOID_HORIZONS = [0.22,0.48,0.82,1.20,1.72,2.35,3.10,3.85];   // compare future lane safety
  const INSIDE_CORNER_STRENGTH = 1.105; // Kart-style inside apex bias
        // extra body-size safety margin
  const ROAD_MARGIN = 1.10;           // outer one-line edge strip is legal air-racing space
  const DEATH_EDGE_EXTRA = 4.50;      // v4.09: lethal zone begins well beyond the real route ribbon
  const ROUTE_PLAN_EXTRA = 0.25;      // planning may use the outer racing rows, but not cut across gaps
  const STUCK_RESCUE_MS = 2200;       // recover from pathological steering states

  const ROUND_UNIT_NAMES={1:"스커지",2:"스카웃",3:"레이스",4:"뮤탈리스크",5:"퀸"};

  // ============================================================
  // v7.60 ~ v7.64 UNIT CHASSIS ENGINE
  // Raw speed spread is deliberately tiny: fastest -> slowest = ~1.3%.
  // Player stats remain the primary source of performance difference.
  // ============================================================
  const UNIT_CHASSIS_764={
    1:{key:"scourge",name:"스커지",role:"초소형 고속형",
      topSpeed:1.010,accel:1.070,turn:1.100,brake:0.960,reaccel:1.070,
      cornerGrip:0.985,cornerResponse:1.080,evadeWidth:0.940,evadeResponse:1.075,safetyGap:0.940,
      hitRadius:0.480,visualScale:0.850},
    2:{key:"scout",name:"스카웃",role:"고속 밸런스형",
      topSpeed:1.005,accel:1.000,turn:0.985,brake:1.000,reaccel:1.000,
      cornerGrip:1.010,cornerResponse:0.990,evadeWidth:1.000,evadeResponse:1.000,safetyGap:1.000,
      hitRadius:0.560,visualScale:1.000},
    3:{key:"wraith",name:"레이스",role:"정밀 반응형",
      topSpeed:1.003,accel:1.025,turn:1.060,brake:1.035,reaccel:1.025,
      cornerGrip:1.045,cornerResponse:1.055,evadeWidth:0.970,evadeResponse:1.060,safetyGap:0.970,
      hitRadius:0.530,visualScale:0.940},
    4:{key:"mutalisk",name:"뮤탈리스크",role:"회피 재가속형",
      topSpeed:1.000,accel:1.045,turn:1.080,brake:0.985,reaccel:1.080,
      cornerGrip:1.025,cornerResponse:1.070,evadeWidth:1.045,evadeResponse:1.085,safetyGap:1.015,
      hitRadius:0.550,visualScale:0.980},
    5:{key:"queen",name:"퀸",role:"대형 안정 제동형",
      topSpeed:0.997,accel:0.955,turn:0.940,brake:1.100,reaccel:0.950,
      cornerGrip:1.020,cornerResponse:0.945,evadeWidth:1.100,evadeResponse:0.940,safetyGap:1.115,
      hitRadius:0.620,visualScale:1.090}
  };

  function unitChassis764(round=currentRound){
    return UNIT_CHASSIS_764[round]||UNIT_CHASSIS_764[2];
  }
  function playerHitRadius764(p){ return unitChassis764().hitRadius; }
  function playerVisualScale764(p){ return unitChassis764().visualScale; }

  function unitCompatibility769(p,round=currentRound){
    const u=unitChassis764(round),s=driverSkill739(p);
    let fit;
    if(u.key==="scourge")
      fit=s.reaction*.24+s.control*.23+s.avoidance*.20+s.acceleration*.18+s.focus*.15;
    else if(u.key==="scout")
      fit=s.pace*.23+s.consistency*.22+s.cornering*.20+s.stability*.20+s.routeReading*.15;
    else if(u.key==="wraith")
      fit=s.control*.25+s.reaction*.22+s.braking*.19+s.prediction*.19+s.cornering*.15;
    else if(u.key==="mutalisk")
      fit=s.avoidance*.25+s.acceleration*.22+s.recovery*.20+s.control*.18+s.reaction*.15;
    else
      fit=s.braking*.25+s.stability*.23+s.riskControl*.21+s.prediction*.17+s.consistency*.14;

    fit=Math.max(0,Math.min(1,fit));
    // Handling only. Stats remain dominant and chassis topSpeed is never altered by fit.
    return {
      fit,
      grade:fit>=.86?"S":fit>=.76?"A":fit>=.64?"B":fit>=.50?"C":"D",
      cornerMul:.985+fit*.025,
      evadeMul:.975+fit*.035,
      turnMul:.985+fit*.030,
      reaccelMul:.985+fit*.030
    };
  }

  function unitSpeedSpread764(){
    const xs=Object.values(UNIT_CHASSIS_764).map(x=>x.topSpeed);
    return {min:Math.min(...xs),max:Math.max(...xs),
      spreadPct:(Math.max(...xs)/Math.min(...xs)-1)*100};
  }

  const names = ["Angel","Egle","GhostRider","Bacilius","Zino","Chotbul","Kaka","Pika","DVA","Taehyeon","LiveCam","Rodust"];
  if(povSelect){
    povSelect.innerHTML=`<option value="-1">POV: OFF</option>`+names.map((n,i)=>`<option value="${i}">${n} POV</option>`).join("");
    povSelect.addEventListener("change",()=>{povPlayerIndex=+povSelect.value;});
  }
  const colors = ["#66e3ff","#ffdb66","#ff7a8a","#9b8cff","#72f0a7","#ff9f5c","#f275ff","#b6f06e","#4df0d0","#ffb86b","#7dd3fc","#c4b5fd"];

  // v29: 20 FM-style attributes + individual driving personality.
  // Values are fixed for this build so a player's identity does not reroll on refresh.
  // v7.33 FIXED ALL-STAT EXPERIMENT
  const playerStats = [
    {pace:86,acceleration:82,cornering:86,insideLine:86,routeReading:90,avoidance:72,reaction:84,prediction:90,control:90,stability:77,braking:85,recovery:78,consistency:86,focus:82,aggression:72,riskControl:72,pressure:76,start:86,endurance:87,luck:83}, // Angel · v8.20 RANDOM 70~90
    {pace:77,acceleration:79,cornering:89,insideLine:86,routeReading:73,avoidance:78,reaction:81,prediction:82,control:81,stability:75,braking:84,recovery:84,consistency:89,focus:81,aggression:71,riskControl:88,pressure:79,start:85,endurance:82,luck:84}, // Egle · v8.20 RANDOM 70~90
    {pace:74,acceleration:78,cornering:88,insideLine:78,routeReading:82,avoidance:83,reaction:72,prediction:87,control:70,stability:72,braking:86,recovery:82,consistency:90,focus:78,aggression:76,riskControl:78,pressure:90,start:80,endurance:81,luck:84}, // GhostRider · v8.20 RANDOM 70~90
    {pace:82,acceleration:85,cornering:86,insideLine:78,routeReading:85,avoidance:84,reaction:76,prediction:89,control:82,stability:78,braking:83,recovery:76,consistency:80,focus:89,aggression:87,riskControl:77,pressure:87,start:88,endurance:88,luck:75}, // Bacilius · v8.20 RANDOM 70~90
    {pace:70,acceleration:77,cornering:78,insideLine:71,routeReading:90,avoidance:74,reaction:88,prediction:87,control:85,stability:81,braking:72,recovery:73,consistency:76,focus:86,aggression:74,riskControl:87,pressure:82,start:80,endurance:71,luck:90}, // Zino · v8.20 RANDOM 70~90
    {pace:78,acceleration:73,cornering:72,insideLine:80,routeReading:85,avoidance:86,reaction:86,prediction:73,control:80,stability:74,braking:87,recovery:90,consistency:77,focus:84,aggression:84,riskControl:78,pressure:90,start:74,endurance:78,luck:79}, // Chotbul · v8.20 RANDOM 70~90
    {pace:70,acceleration:84,cornering:86,insideLine:70,routeReading:70,avoidance:79,reaction:81,prediction:85,control:81,stability:71,braking:90,recovery:75,consistency:76,focus:88,aggression:72,riskControl:75,pressure:86,start:77,endurance:82,luck:73}, // Kaka · v8.20 RANDOM 70~90
    {pace:89,acceleration:88,cornering:71,insideLine:77,routeReading:82,avoidance:74,reaction:90,prediction:71,control:77,stability:80,braking:72,recovery:83,consistency:89,focus:81,aggression:77,riskControl:90,pressure:85,start:76,endurance:72,luck:87}, // Pika · v8.20 RANDOM 70~90
    {pace:80,acceleration:82,cornering:73,insideLine:70,routeReading:88,avoidance:82,reaction:75,prediction:80,control:85,stability:72,braking:85,recovery:75,consistency:70,focus:79,aggression:90,riskControl:80,pressure:87,start:80,endurance:84,luck:82}, // DVA · v8.20 RANDOM 70~90
    {pace:73,acceleration:80,cornering:83,insideLine:90,routeReading:70,avoidance:72,reaction:74,prediction:85,control:83,stability:70,braking:78,recovery:76,consistency:90,focus:74,aggression:78,riskControl:78,pressure:76,start:72,endurance:79,luck:70}, // Taehyeon · v8.20 RANDOM 70~90
    {pace:80,acceleration:83,cornering:82,insideLine:72,routeReading:79,avoidance:78,reaction:84,prediction:88,control:88,stability:87,braking:89,recovery:82,consistency:87,focus:82,aggression:80,riskControl:88,pressure:78,start:73,endurance:75,luck:80}, // LiveCam · v8.20 RANDOM 70~90
    {pace:77,acceleration:84,cornering:85,insideLine:75,routeReading:84,avoidance:84,reaction:88,prediction:80,control:76,stability:80,braking:86,recovery:76,consistency:78,focus:86,aggression:79,riskControl:81,pressure:84,start:85,endurance:80,luck:77}, // Rodust · v8.20 RANDOM 70~90
  ];

  const drivingStyles = [
    {style:"apexHunter",attack:1.1,safety:0.88,pack:1.06}, // Angel
    {style:"safeReader",attack:0.92,safety:1.14,pack:0.96}, // Egle
    {style:"attacker",attack:1.15,safety:0.82,pack:1.1}, // GhostRider
    {style:"lineMaster",attack:1.05,safety:1.02,pack:1.0}, // Bacilius
    {style:"balanced",attack:1.0,safety:1.0,pack:1.0}, // Zino
    {style:"controller",attack:0.94,safety:1.12,pack:0.94}, // Chotbul
    {style:"patient",attack:0.96,safety:1.08,pack:0.97}, // Kaka
    {style:"opportunist",attack:1.08,safety:0.94,pack:1.05}, // Pika
    {style:"balanced",attack:1.02,safety:1.01,pack:1.03}, // HongKey
    {style:"lineMaster",attack:1.04,safety:1.03,pack:1.01}, // TaeHyeon
    {style:"controller",attack:1.01,safety:1.08,pack:1.04}, // DVA
    {style:"safeReader",attack:0.98,safety:1.10,pack:0.99}, // LiveCam
  ];

  // v2.21: stronger behavioral identity; never changes raw base speed.
  // v4.59.5 SMOOTH RECOVERY: keep the survival corridor, suppress stop-stutter further, hold through chained threats, and blend back to pace smoothly.
  // v4.46 RACE-SITUATION AI: leader/chaser/clutch behavior uses Aggression, Risk Control and Pressure.
  // v4.45 PERSONALITY AI 2.0: persistent styles now alter line commitment, safety margin,
  // click rhythm and rejoin patience. They never create random deaths or hidden speed boosts.
  const drivingIdentity={
    apexHunter:{apex:1.18,safety:.94,pass:1.06,patience:.91,control:"zigzag",commit:1.10,evadeWidth:.96,rejoin:1.10},
    safeReader:{apex:.93,safety:1.18,pass:.91,patience:1.18,control:"wide",commit:.91,evadeWidth:1.15,rejoin:.82},
    attacker:{apex:1.08,safety:.90,pass:1.18,patience:.88,control:"zigzag",commit:1.15,evadeWidth:.94,rejoin:1.08},
    lineMaster:{apex:1.17,safety:1.02,pass:1.04,patience:1.02,control:"zigzag",commit:1.11,evadeWidth:1.00,rejoin:1.13},
    balanced:{apex:1,safety:1,pass:1,patience:1,control:"zigzag",commit:1,evadeWidth:1,rejoin:1},
    controller:{apex:.98,safety:1.12,pass:.95,patience:1.08,control:"zigzag",commit:.98,evadeWidth:1.08,rejoin:.94},
    patient:{apex:.95,safety:1.12,pass:.95,patience:1.20,control:"wide",commit:.90,evadeWidth:1.12,rejoin:.84},
    opportunist:{apex:1.10,safety:.96,pass:1.14,patience:.94,control:"zigzag",commit:1.10,evadeWidth:.98,rejoin:1.05}
  };
  function identityOf(p){return drivingIdentity[p.drivingStyle?.style]||drivingIdentity.balanced;}

  // v4.47 UNIT ADAPTATION AI: every chassis asks for a different kind of execution.
  // This is not a hidden unit rating. Compatibility is derived from the same visible
  // 20 FM attributes, so a racer can naturally be excellent on one unit and ordinary on another.


  const signatureMoves={apexHunter:{label:"INSIDE APEX",inside:1.24,skim:1.18},safeReader:{label:"SAFE ARC",inside:.82,skim:1.04},attacker:{label:"THREAD ATTACK",inside:1.08,skim:1.30},lineMaster:{label:"PERFECT LINE",inside:1.30,skim:1.14},balanced:{label:"ADAPTIVE",inside:1,skim:1},controller:{label:"CONTROL CUT",inside:.90,skim:1.06},patient:{label:"WAIT & CUT",inside:.92,skim:1.08},opportunist:{label:"GAP HUNTER",inside:1.16,skim:1.26}};




  // ============================================================
  // v7.70 MULTI MAP CORE
  // Every map uses the same normalized 172 x 178 logical space.
  // v7.70 binds the existing approved S-map as Map 01.
  // The other ten maps are catalogued now and receive real geometry in v7.71+.
  // ============================================================
  const MAP_POOL_770=[
    {
      id:"s_map",slot:1,name:"S맵",en:"S Map",theme:"Blue Neon City",
      tags:["기준맵","밸런스","테크니컬"],geometryReady:true,
      image:"map_v672_equal_medium_start_goal.png?v=770-map-core",
      imageSize:{w:696,h:720},logicalSize:{w:172,h:178},
      start:{x:31.05,y:132.55},goal:{x:141.50,y:22.50},
      safeZones:{
        start:{x0:22.80,y0:124.30,x1:39.30,y1:140.80},
        goal:{x0:133.25,y0:14.25,x1:149.75,y1:30.75}
      },
      miniCrop:{x:24,y:8,w:127,h:150},
      sectorCuts:[.29,.42,.66,.77,.84],
      sectorNames:["스타트→첫 코너","5→3시 세로","3→9시 중단","9→11시 세로","11→12시 상단","마지막 직선"],
      special:{shortcuts:false,obstacles:false,wideRoad:false,multiRoute:false,verticality:false},
      observerProfile:"baseline"
    },
    {id:"ice_ring",slot:3,name:"아이스 크라운",en:"Ice Crown",theme:"Frozen Crown Canyon",
      tags:["원형","연속코너","테크니컬"],geometryReady:false,
      special:{shortcuts:false,obstacles:false,wideRoad:true,multiRoute:false,verticality:false},observerProfile:"ring"},
    {id:"desert_oasis",slot:4,name:"사막 오아시스",en:"Desert Oasis",theme:"Desert & Oasis",
      tags:["넓은길","지름길","테마"],geometryReady:false,
      special:{shortcuts:true,obstacles:false,wideRoad:true,multiRoute:true,verticality:false},observerProfile:"open-wide"},
    {id:"neon_city",slot:5,name:"네오 시티",en:"Neon City",theme:"Neon Metropolis",
      tags:["고속","넓은길","다층"],geometryReady:false,
      special:{shortcuts:false,obstacles:false,wideRoad:true,multiRoute:false,verticality:true},observerProfile:"high-speed"},
    {id:"double_hairpin",slot:6,name:"더블 헤어핀",en:"Double Hairpin",theme:"Forest Hairpins",
      tags:["헤어핀","인코스","코너"],geometryReady:false,
      special:{shortcuts:false,obstacles:false,wideRoad:false,multiRoute:false,verticality:false},observerProfile:"technical"},
    {id:"skyway",slot:7,name:"스카이웨이",en:"Skyway",theme:"Floating Sky City",
      tags:["하늘","다층","갈림길"],geometryReady:false,
      special:{shortcuts:false,obstacles:false,wideRoad:true,multiRoute:true,verticality:true},observerProfile:"sky"},
    {id:"star_fish",slot:8,name:"스타 피쉬",en:"Star Fish",theme:"Tropical Star Island",
      tags:["별모양","갈림길","테마"],geometryReady:false,
      special:{shortcuts:false,obstacles:false,wideRoad:true,multiRoute:true,verticality:false},observerProfile:"branching"},
    {id:"cliff_hanger",slot:9,name:"스카이 클리프",en:"Sky Cliff",theme:"High Cliff",
      tags:["절벽","초협로","고난도지름길"],geometryReady:false,
      special:{shortcuts:true,obstacles:false,wideRoad:false,multiRoute:true,verticality:true},observerProfile:"precision"},
    {id:"triple_diamond",slot:9,name:"데스티니 게이트",en:"Destiny Gate",theme:"Heaven vs Hell Destiny Gate",
      tags:["데스티니게이트","2스타트","천국vs지옥"],geometryReady:false,
      special:{shortcuts:false,obstacles:false,wideRoad:true,multiRoute:true,verticality:false},observerProfile:"branching"}
  ];
  const MAP_DEFINITIONS_770=Object.fromEntries(MAP_POOL_770.map(m=>[m.id,m]));
  let activeMapId770="s_map";
  let activeMap770=MAP_DEFINITIONS_770[activeMapId770];

  function currentMap770(){ return activeMap770||MAP_DEFINITIONS_770.s_map; }
  function mapStart770(){ const m=currentMap770(); return {x:m.start?.x??31.05,y:m.start?.y??132.55}; }
  function mapGoal770(){ const m=currentMap770(); return {x:m.goal?.x??141.5,y:m.goal?.y??22.5}; }
  function mapPoolPublic770(){
    return MAP_POOL_770.map(m=>({
      id:m.id,slot:m.slot,name:m.name,en:m.en,theme:m.theme,tags:[...(m.tags||[])],
      geometryReady:!!m.geometryReady,special:{...(m.special||{})},observerProfile:m.observerProfile,
      courseType:m.courseType775||"point-to-point",lapRequired:!!m.lapRequired775,
      finishRule:m.finishRule775||"end-gate",sharedGate778:!!m.sharedGate778,
      start:{...(m.start||{})},finish:{...(m.goal||{})}
    }));
  }

  const profiles = playerStats.map(s => ({
    pace:s.pace,
    line:Math.round((s.cornering+s.insideLine+s.routeReading)/3),
    control:Math.round((s.control+s.stability+s.reaction)/3),
    aggression:s.aggression
  }));

  // Existing approved S-map geometry. v7.70 promotes it to Map 01 data.
  const S_MAP_ROUTE_770 = [
    [31.00,132.50],[55,132.8],[82,132.8],[108,132.8],[128,132.8],
    [128,118],[128,100],[128,84],[128,74],
    [110,74],[92,74],[74,74],[58,74],[44,74],
    [44,60],[44,46],[44,32],[44,23.5],
    [70,23.5],[96,23.5],[122,23.5],[143.0,23.5]
  ];
  const S_MAP_WIDTHS_770=[14.0,14.0,14.0,14.6,14.6,14.6,14.0,14.6,14.6,14.6,14.0,14.0,14.6,14.6,14.6,14.0,14.6,14.6,14.6,14.0,14.0,14.0];

  let route=S_MAP_ROUTE_770.map(p=>[...p]);
  let widths=[...S_MAP_WIDTHS_770];
  const segs=[];
  let routeLength=0;
  function rebuildRouteGeometry770(){
    segs.length=0;routeLength=0;
    for(let i=0;i<route.length-1;i++){
      const a=route[i],b=route[i+1];
      const dx=b[0]-a[0],dy=b[1]-a[1];
      const L=Math.hypot(dx,dy)||1;
      segs.push({a,b,dx,dy,L,ux:dx/L,uy:dy/L,nx:-dy/L,ny:dx/L,start:routeLength});
      routeLength+=L;
    }
  }
  rebuildRouteGeometry770();

  const map=new Image();
  let MAP_IMAGE_SCALE_X=696/172;
  let MAP_IMAGE_SCALE_Y=720/178;
  function applyMapImage770(m=currentMap770()){
    const sz=m.imageSize||{w:696,h:720};
    const ls=m.logicalSize||{w:172,h:178};
    MAP_W=Number(ls.w)||172;MAP_H=Number(ls.h)||178;
    MAP_IMAGE_SCALE_X=sz.w/MAP_W;MAP_IMAGE_SCALE_Y=sz.h/MAP_H;
    const previousMapId=map._mapId791||"";
    map._mapId791=m.id||"";
    map._fallback791=m.imageFallback791||"";
    if(m.image){
      const wanted=m.image.split("?")[0];
      let current="";
      try{current=(new URL(map.src||"",document.baseURI)).pathname.split("/").pop()||"";}catch(e){}
      // v1.64.0: a league set map change must replace the shared Image immediately.
      // Clear the old minimap so ObserverS can never remain visible while Clover loads.
      if(previousMapId!==m.id){
        const mc=document.getElementById("miniMap");
        if(mc)mc.getContext("2d").clearRect(0,0,mc.width,mc.height);
      }
      if(previousMapId!==m.id || current!==wanted || !map.complete || map.naturalWidth<=0) map.src=m.image;
    }
  }
  applyMapImage770();

  let players = [];
  let observers = [];
  let running = false;
  let paused = false;
  let pauseStarted = 0;
  let raceStart = 0;
  let lastTs = 0;
  let raf = 0;
  let camX = 28, camY = 158;
  let prevCamX730 = camX, prevCamY730 = camY;
  let renderAlpha730 = 1;

  function lerp730(a,b,t){ return a+(b-a)*t; }
  function renderPlayerPos730(p){
    const a=running?renderAlpha730:1;
    const px=Number.isFinite(p.simPrevX)?p.simPrevX:p.x;
    const py=Number.isFinite(p.simPrevY)?p.simPrevY:p.y;
    return {x:lerp730(px,p.x,a),y:lerp730(py,p.y,a)};
  }
  function renderObserverPos730(o){
    const a=running?renderAlpha730:1;
    const px=Number.isFinite(o.simPrevX)?o.simPrevX:o.x;
    const py=Number.isFinite(o.simPrevY)?o.simPrevY:o.y;
    return {x:lerp730(px,o.x,a),y:lerp730(py,o.y,a)};
  }

  const ROUND_POINTS=[10,7,5,3,2,1,0,-1,-2,-3,-4,-5];
  let currentRound=1;

  // ============================================================
  // v8.21 TEAM LEAGUE TEST
  // A vs B / 6 players each / Sets 1~6 unique / Ace set on 3:3
  // Each set = 1v1 first-to-2 heats -> only 2:0 or 2:1.
  // ============================================================
  const TEAM_LEAGUE_RULES_821={
    bestOfSets:7,
    matchWinsNeeded:4,
    regularSets:6,
    heatWinsNeeded:2,
    maxHeatsPerSet:3,
    aceSet:7,
    regularNoRepeat:true,
    aceRepeatAllowed:true
  };

  const TEAM_LEAGUE_ROSTERS_821={
    A:[0,1,2,3,4,5],
    B:[6,7,8,9,10,11]
  };

  let teamLeague821={
    active:false,
    setNo:1,
    heatNo:1,
    teamScore:{A:0,B:0},
    setHeatScore:{A:0,B:0},
    used:{A:[],B:[]},
    current:{A:null,B:null},
    sets:[],
    winner:null
  };

  function teamLeaguePlayer821(team,setNo=teamLeague821.setNo){
    const roster=TEAM_LEAGUE_ROSTERS_821[team]||[];
    if(setNo<=6)return roster[setNo-1]??null;
    // Ace decision: highest average v8.20 stat; previous appearance is allowed.
    let best=null,bestAvg=-Infinity;
    for(const idx of roster){
      const st=playerStats[idx]||{};
      const vals=Object.values(st).filter(v=>Number.isFinite(v));
      const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
      if(avg>bestAvg){bestAvg=avg;best=idx;}
    }
    return best;
  }

  function resetTeamLeague821(){
    teamLeague821={
      active:true,
      setNo:1,
      heatNo:1,
      teamScore:{A:0,B:0},
      setHeatScore:{A:0,B:0},
      used:{A:[],B:[]},
      current:{A:teamLeaguePlayer821("A",1),B:teamLeaguePlayer821("B",1)},
      sets:[],
      winner:null
    };
    return teamLeagueState821();
  }

  function teamLeagueState821(){
    const pA=teamLeague821.current.A;
    const pB=teamLeague821.current.B;
    return {
      rules:{...TEAM_LEAGUE_RULES_821},
      active:teamLeague821.active,
      setNo:teamLeague821.setNo,
      heatNo:teamLeague821.heatNo,
      teamScore:{...teamLeague821.teamScore},
      setHeatScore:{...teamLeague821.setHeatScore},
      current:{
        A:pA==null?null:{index:pA,name:names[pA]},
        B:pB==null?null:{index:pB,name:names[pB]}
      },
      used:{A:[...teamLeague821.used.A],B:[...teamLeague821.used.B]},
      winner:teamLeague821.winner,
      sets:teamLeague821.sets.map(x=>({...x,heatScore:{...x.heatScore}}))
    };
  }

  function awardTeamLeagueHeat821(team){
    if(!teamLeague821.active||teamLeague821.winner)return teamLeagueState821();
    if(team!=="A"&&team!=="B")throw new Error("team must be A or B");

    teamLeague821.setHeatScore[team]++;
    const wonSet=teamLeague821.setHeatScore[team]>=TEAM_LEAGUE_RULES_821.heatWinsNeeded;

    if(!wonSet){
      teamLeague821.heatNo++;
      return teamLeagueState821();
    }

    const setNo=teamLeague821.setNo;
    const score={...teamLeague821.setHeatScore};
    const pA=teamLeague821.current.A,pB=teamLeague821.current.B;

    teamLeague821.teamScore[team]++;
    if(setNo<=6){
      if(pA!=null&&!teamLeague821.used.A.includes(pA))teamLeague821.used.A.push(pA);
      if(pB!=null&&!teamLeague821.used.B.includes(pB))teamLeague821.used.B.push(pB);
    }
    teamLeague821.sets.push({
      setNo,
      A:pA==null?null:{index:pA,name:names[pA]},
      B:pB==null?null:{index:pB,name:names[pB]},
      winner:team,
      heatScore:score
    });

    // 4 team points ends the match immediately.
    if(teamLeague821.teamScore[team]>=TEAM_LEAGUE_RULES_821.matchWinsNeeded){
      teamLeague821.winner=team;
      teamLeague821.active=false;
      return teamLeagueState821();
    }

    // Sets 1~6 use one unique player per team.
    if(setNo<6){
      teamLeague821.setNo++;
      teamLeague821.heatNo=1;
      teamLeague821.setHeatScore={A:0,B:0};
      teamLeague821.current={
        A:teamLeaguePlayer821("A",teamLeague821.setNo),
        B:teamLeaguePlayer821("B",teamLeague821.setNo)
      };
      return teamLeagueState821();
    }

    // After Set 6: only 3:3 can continue to the Ace deciding set.
    if(setNo===6 &&
       teamLeague821.teamScore.A===3 &&
       teamLeague821.teamScore.B===3){
      teamLeague821.setNo=7;
      teamLeague821.heatNo=1;
      teamLeague821.setHeatScore={A:0,B:0};
      teamLeague821.current={
        A:teamLeaguePlayer821("A",7),
        B:teamLeaguePlayer821("B",7)
      };
      return teamLeagueState821();
    }

    // Defensive fallback: with a best-of-7 structure, one side should already have 4.
    const winner=teamLeague821.teamScore.A>teamLeague821.teamScore.B?"A":"B";
    teamLeague821.winner=winner;
    teamLeague821.active=false;
    return teamLeagueState821();
  }


  // ============================================================
  // v1.0.0 TEAM LEAGUE — NEW MAIN GAME FLOW
  // 12 players -> random A/B teams (6 each)
  // Sets 1-6: one unique player each, random appearance order.
  // Each set is 1v1 first-to-2 heats: only 2:0 or 2:1.
  // If 3:3 after set 6, set 7 is an ace decider and repeat appearance is allowed.
  // ============================================================
  const LEAGUE_RULES_100={
    teamSize:6,regularSets:6,maxSets:7,setWinsNeeded:4,
    heatWinsNeeded:2,maxHeatsPerSet:3,
    aceOnlyAtThreeThree:true,aceRepeatAllowed:true
  };

  let league100=null;


  function neonDriftMapId108(){
    // v1.63.0: ObserverS has one canonical id only.
    // Never infer it from labels ("neon_city" is Heart in the current roster).
    return MAP_DEFINITIONS_770?.s_map ? "s_map" : null;
  }

  function shuffle100(arr){
    const out=[...arr];
    for(let i=out.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [out[i],out[j]]=[out[j],out[i]];
    }
    return out;
  }

  function resetLeague100(){
    const all=shuffle100(names.map((_,i)=>i));
    const teamA=shuffle100(all.slice(0,6));
    const teamB=shuffle100(all.slice(6,12));
    league100={
      phase:"bracket",
      setNo:1,
      heatNo:1,
      heatScore:{A:0,B:0},
      teamScore:{A:0,B:0},
      teamA,teamB,
      ace:{A:null,B:null},
      results:[],
      winner:null,
      bannedMaps:{A:null,B:null},
      setMaps:[],
      mapHistory:[],
      currentMapId:null
    };

    // v1.42.0 test draft:
    // Set 1 is fixed to Three-Leaf Clover for route testing.
    // Neon Drift is no longer fixed and is mixed into the randomized remaining sets.
    // Neither the Clover test map nor Neon Drift can be banned during this test build.
    const neon108=neonDriftMapId108();
    const clover140=MAP_DEFINITIONS_770?.double_hairpin ? "double_hairpin" :
      (MAP_POOL_770.find(m=>(m?.name||"").includes("세잎"))?.id||null);
    const protected140=new Set([clover140,neon108].filter(Boolean));
    const banPool108=shuffle100(MAP_POOL_770.map(m=>m.id).filter(id=>!protected140.has(id)));

    league100.bannedMaps.A=banPool108[0]??null;
    league100.bannedMaps.B=banPool108.find(id=>id!==league100.bannedMaps.A)??banPool108[1]??null;

    const available108=shuffle100(
      MAP_POOL_770.map(m=>m.id).filter(id=>
        id!==league100.bannedMaps.A &&
        id!==league100.bannedMaps.B &&
        id!==clover140
      )
    );

    league100.setMaps=[
      clover140||neon108,
      ...available108.slice(0,6)
    ];
    prepareLeaguePair100();
    renderLeagueBoard100();
    renderLeagueSide100();
    showLeagueBoard100();
    return leagueState100();
  }

  function leaguePair100(setNo=league100?.setNo||1){
    if(!league100)return {A:null,B:null};
    if(setNo<=6)return {A:league100.teamA[setNo-1],B:league100.teamB[setNo-1]};
    return {A:league100.ace.A,B:league100.ace.B};
  }

  function prepareLeaguePair100(){
    if(!league100)return;
    if(league100.setNo===7){
      // ACE names are chosen only after a real 3:3 tie activates Set 7.
      if(league100.teamScore.A===3&&league100.teamScore.B===3){
        if(league100.ace.A==null)league100.ace.A=league100.teamA[Math.floor(Math.random()*league100.teamA.length)];
        if(league100.ace.B==null)league100.ace.B=league100.teamB[Math.floor(Math.random()*league100.teamB.length)];
      }
    }
    const pair=leaguePair100();
    league100.current={A:pair.A,B:pair.B};
  }

  function leagueState100(){
    if(!league100)return null;
    const pair=leaguePair100();
    return {
      build:BUILD_ID,
      phase:league100.phase,
      setNo:league100.setNo,
      heatNo:league100.heatNo,
      heatScore:{...league100.heatScore},
      teamScore:{...league100.teamScore},
      teams:{
        A:league100.teamA.map(i=>({index:i,name:names[i]})),
        B:league100.teamB.map(i=>({index:i,name:names[i]}))
      },
      current:{
        A:pair.A==null?null:{index:pair.A,name:names[pair.A]},
        B:pair.B==null?null:{index:pair.B,name:names[pair.B]}
      },
      map:{
        id:league100.currentMapId,
        name:league100.currentMapId?(MAP_DEFINITIONS_770[league100.currentMapId]?.name||league100.currentMapId):null,
        history:[...(league100.mapHistory||[])],
        setMaps:(league100.setMaps||[]).map((id,i)=>({
          setNo:i+1,
          id,
          name:MAP_DEFINITIONS_770[id]?.name||id
        }))
      },
      ace:{
        A:league100.ace.A==null?null:{index:league100.ace.A,name:names[league100.ace.A]},
        B:league100.ace.B==null?null:{index:league100.ace.B,name:names[league100.ace.B]}
      },
      results:league100.results.map(r=>({...r,score:{...r.score}})),
      winner:league100.winner,
      bans:{
        A:league100.bannedMaps?.A?{
          id:league100.bannedMaps.A,
          name:MAP_DEFINITIONS_770[league100.bannedMaps.A]?.name||league100.bannedMaps.A
        }:null,
        B:league100.bannedMaps?.B?{
          id:league100.bannedMaps.B,
          name:MAP_DEFINITIONS_770[league100.bannedMaps.B]?.name||league100.bannedMaps.B
        }:null
      },
      rules:{...LEAGUE_RULES_100}
    };
  }

  function showLeagueBoard100(){
    const el=document.getElementById("leagueBoard100");
    if(el)el.classList.remove("hidden");
  }
  function hideLeagueBoard100(){
    const el=document.getElementById("leagueBoard100");
    if(el)el.classList.add("hidden");
  }

  function leagueResultForSet100(setNo){
    return league100?.results?.find(r=>r.setNo===setNo)||null;
  }

  function leagueMapVisual133(mapId){
    const m=mapId?MAP_DEFINITIONS_770[mapId]:null;
    const src=m?.image||"";
    const name=m?.name||mapId||"맵 미정";
    return {src,name};
  }

  function ensureLeagueMapModal140(){
    let modal=document.getElementById("leagueMapModal140");
    if(modal)return modal;
    modal=document.createElement("div");
    modal.id="leagueMapModal140"; modal.className="overlay hidden";
    modal.innerHTML=`<div class="modalCard league-map-modal-card-140"><button type="button" class="closeBtn" aria-label="닫기">×</button><h2 id="leagueMapModalTitle140">맵</h2><img id="leagueMapModalImage140" alt="맵 확대 이미지"></div>`;
    document.body.appendChild(modal);
    modal.querySelector(".closeBtn").onclick=()=>modal.classList.add("hidden");
    modal.onclick=e=>{if(e.target===modal)modal.classList.add("hidden")};
    return modal;
  }
  function openLeagueMap140(mapId){
    const m=MAP_DEFINITIONS_770?.[mapId]; if(!m)return;
    const modal=ensureLeagueMapModal140();
    modal.querySelector("#leagueMapModalTitle140").textContent=m.name||mapId;
    const img=modal.querySelector("#leagueMapModalImage140"); img.src=m.image||""; img.alt=`${m.name||mapId} 확대 이미지`;
    modal.classList.remove("hidden");
  }
  function openLeaguePlayer140(sourceIndex){
    if(!Number.isInteger(sourceIndex)||!playerStats[sourceIndex])return;
    const stats={...playerStats[sourceIndex]};
    const pf=profiles[sourceIndex]||{};
    const style=pf.style||pf.drivingStyle||"balanced";
    const modal=document.getElementById("playerModal");
    document.getElementById("playerModalTitle").textContent=`${names[sourceIndex]} · 선수 데이터`;
    document.getElementById("playerModalBody").innerHTML=`<div class="profile-hero">${avatarHtml(sourceIndex,"profile-avatar")}<div><b>${names[sourceIndex]}</b><span>대진표 선수 정보</span><small>기본 능력치</small></div></div><div class="statGrid">${Object.entries(stats).map(([k,v])=>`<div class="statCell"><span>${statLabel(k)}</span><b>${v}</b></div>`).join("")}</div>`;
    modal.classList.remove("hidden");
  }

  function renderLeagueBoard100(){
    if(!league100)return;
    const rosterA=document.getElementById("leagueRosterA100");
    const rosterB=document.getElementById("leagueRosterB100");
    const score=document.getElementById("leagueBoardScore100");
    const schedule=document.getElementById("leagueSchedule100");
    const bans=document.getElementById("leagueBans100");
    const msg=document.getElementById("leagueBoardMessage100");
    const proceed=document.getElementById("leagueProceed100");

    if(rosterA)rosterA.innerHTML=league100.teamA.map((idx,i)=>
      `<div class="league-roster-player-100"><span>${i+1}</span><b>${names[idx]}</b></div>`
    ).join("");
    if(rosterB)rosterB.innerHTML=league100.teamB.map((idx,i)=>
      `<div class="league-roster-player-100"><span>${i+1}</span><b>${names[idx]}</b></div>`
    ).join("");
    if(score)score.textContent=`${league100.teamScore.A} : ${league100.teamScore.B}`;

    if(bans){
      const banA=league100.bannedMaps?.A?(MAP_DEFINITIONS_770[league100.bannedMaps.A]?.name||league100.bannedMaps.A):"-";
      const banB=league100.bannedMaps?.B?(MAP_DEFINITIONS_770[league100.bannedMaps.B]?.name||league100.bannedMaps.B):"-";
      const banAV=leagueMapVisual133(league100.bannedMaps?.A);
      const banBV=leagueMapVisual133(league100.bannedMaps?.B);
      bans.innerHTML=`
        <div class="league-ban-a-100"><div class="league-ban-card-133 league-map-open-140" data-map-id="${league100.bannedMaps?.A||""}">${banAV.src?`<img src="${banAV.src}" alt="${banA}">`:""}<div class="league-ban-copy-133"><em>RED TEAM BAN</em><strong>${banA}</strong></div></div></div>
        <div class="league-ban-b-100"><div class="league-ban-card-133 league-map-open-140" data-map-id="${league100.bannedMaps?.B||""}"><div class="league-ban-copy-133"><em>BLUE TEAM BAN</em><strong>${banB}</strong></div>${banBV.src?`<img src="${banBV.src}" alt="${banB}">`:""}</div></div>`;
    }

    if(schedule){
      const rows=[];

      for(let setNo=1;setNo<=6;setNo++){
        const a=league100.teamA[setNo-1],b=league100.teamB[setNo-1];
        const r=leagueResultForSet100(setNo);
        const mapId=league100.setMaps?.[setNo-1];
        const mapName=mapId?(MAP_DEFINITIONS_770[mapId]?.name||mapId):"맵 미정";
        const cls=[
          "league-schedule-row-100",
          r?"done":"",
          !r&&league100.setNo===setNo&&!league100.winner?"current":""
        ].filter(Boolean).join(" ");

        const mapV=leagueMapVisual133(mapId);
        rows.push(`<div class="${cls}">
          <span class="set">${setNo}세트</span>
          <button type="button" class="league-map-cell-133 league-map-open-140" data-map-id="${mapId||""}" aria-label="${mapName} 확대 보기">${mapV.src?`<img src="${mapV.src}" alt="${mapName}">`:""}<small>${mapName}</small></button>
          <button type="button" class="a league-player-open-140" data-source-index="${a}">${names[a]}</button>
          <span class="vs">VS</span>
          <button type="button" class="b league-player-open-140" data-source-index="${b}">${names[b]}</button>
          <span class="result">${r?`${r.score.A} : ${r.score.B}`:"-"}</span>
        </div>`);
      }

      // v1.0.3: ACE row is always visible.
      // Players remain ??? until Sets 1~6 actually finish 3:3.
      const aceActivated=league100.setNo===7 ||
        league100.results.some(r=>r.setNo===7) ||
        (league100.results.length>=6&&league100.teamScore.A===3&&league100.teamScore.B===3);

      const aceMapId=league100.setMaps?.[6];
      const aceMapName=aceMapId?(MAP_DEFINITIONS_770[aceMapId]?.name||aceMapId):"맵 미정";
      const aceResult=leagueResultForSet100(7);

      if(aceActivated)prepareLeaguePair100();

      const aceA=aceActivated&&league100.ace.A!=null?names[league100.ace.A]:"???";
      const aceB=aceActivated&&league100.ace.B!=null?names[league100.ace.B]:"???";

      const aceMapV=leagueMapVisual133(aceMapId);
      rows.push(`<div class="league-schedule-row-100 ace ${!aceResult&&league100.setNo===7?"current":""} ${aceResult?"done":""}">
        <span class="set">7세트<br>ACE</span>
        <button type="button" class="league-map-cell-133 league-map-open-140" data-map-id="${aceMapId||""}" aria-label="${aceMapName} 확대 보기">${aceMapV.src?`<img src="${aceMapV.src}" alt="${aceMapName}">`:""}<small>${aceMapName}</small></button>
        <button type="button" class="a league-player-open-140" ${aceActivated&&league100.ace.A!=null?`data-source-index="${league100.ace.A}"`:"disabled"}>${aceA}</button>
        <span class="vs">VS</span>
        <button type="button" class="b league-player-open-140" ${aceActivated&&league100.ace.B!=null?`data-source-index="${league100.ace.B}"`:"disabled"}>${aceB}</button>
        <span class="result">${aceResult?`${aceResult.score.A} : ${aceResult.score.B}`:"-"}</span>
      </div>`);

      schedule.innerHTML=rows.join("");
    }

    // v1.42.0 uses one delegated pointer handler (installed once below).
    // Avoid rebinding every schedule render; this also fixes delayed/missed taps.

    if(msg){
      if(league100.winner){
        msg.textContent=`${league100.winner==="A"?"RED":"BLUE"} TEAM 승리 · 최종 ${league100.teamScore.A} : ${league100.teamScore.B}`;
      }else if(league100.results.length){
        const last=league100.results[league100.results.length-1];
        msg.textContent=`${last.setNo}세트 ${last.winner==="A"?"RED":"BLUE"} TEAM 승리 (${last.score.A}:${last.score.B}) · 팀 스코어 ${league100.teamScore.A}:${league100.teamScore.B}`;
      }else{
        msg.textContent="12명 랜덤 팀 배정 · 출전 순서 랜덤 완료";
      }
    }

    if(proceed){
      if(league100.winner){
        proceed.textContent="경기 종료";
        proceed.disabled=true;
      }else{
        proceed.disabled=false;
        proceed.textContent=league100.setNo===7?"에이스 결정전 진행하기":`${league100.setNo}세트 진행하기`;
      }
    }
  }

  function renderLeagueSide100(){
    if(!league100)return;
    const score=document.getElementById("leagueSideScore100");
    const current=document.getElementById("leagueSideCurrent100");
    const sets=document.getElementById("leagueSideSets100");
    const pair=leaguePair100();

    if(score)score.innerHTML=`
      <div class="league-side-team-100 a"><span>RED TEAM</span><strong>${league100.teamScore.A}</strong></div>
      <em>VS</em>
      <div class="league-side-team-100 b"><span>BLUE TEAM</span><strong>${league100.teamScore.B}</strong></div>`;

    if(current){
      if(league100.winner){
        current.innerHTML=`<small>FINAL RESULT</small><div class="league-side-heat-100">${league100.winner==="A"?"RED":"BLUE"} TEAM WIN</div>`;
      }else{
        const mapName100=league100.currentMapId?(MAP_DEFINITIONS_770[league100.currentMapId]?.name||league100.currentMapId):"맵 준비";
        current.innerHTML=`<small>${league100.setNo===7?"ACE DECIDER":`${league100.setNo} SET`} · ${mapName100} · ${league100.heatNo}번째 경기</small>
          <div class="league-side-current-row-100">
            <b class="a">${pair.A==null?"-":names[pair.A]}</b><i>VS</i><b class="b">${pair.B==null?"-":names[pair.B]}</b>
          </div>
          <div class="league-side-heat-100">${league100.heatScore.A} : ${league100.heatScore.B}</div>`;
      }
    }

    if(sets){
      const max=league100.setNo===7||leagueResultForSet100(7)?7:6;
      sets.innerHTML=Array.from({length:max},(_,i)=>{
        const setNo=i+1,r=leagueResultForSet100(setNo);
        const p=setNo<=6
          ? {A:league100.teamA[setNo-1],B:league100.teamB[setNo-1]}
          : {A:league100.ace.A,B:league100.ace.B};
        return `<div class="league-side-set-row-100">
          <b>${setNo===7?"ACE":setNo+"S"}</b>
          <span class="a" title="${p.A==null?"-":names[p.A]}">${p.A==null?"-":names[p.A]}</span>
          <span class="score">${r?`${r.score.A}:${r.score.B}`:"-"}</span>
          <span class="b" title="${p.B==null?"-":names[p.B]}">${p.B==null?"-":names[p.B]}</span>
        </div>`;
      }).join("");
    }
  }
  function nextLeagueMap100(){
    if(!league100)return currentMap770().id;
    const setIndex=Math.max(0,Math.min(6,(league100.setNo||1)-1));
    const id=league100.setMaps?.[setIndex] || MAP_POOL_770[setIndex%MAP_POOL_770.length]?.id || currentMap770().id;
    league100.currentMapId=id;
    if(!league100.mapHistory.includes(id))league100.mapHistory.push(id);
    return id;
  }


  function setupLeagueHeat100(){
    const pair=leaguePair100();
    if(pair.A==null||pair.B==null)return false;

    matchMode="team";
    activeSourceIndexes=[pair.A,pair.B];
    teamAssignments={0:"RED",1:"BLUE"};
    playerTournament={};
    activeSourceIndexes.forEach((src,i)=>{
      playerTournament[i]={
        name:names[src],
        team:i===0?"RED":"BLUE",
        total:0,rounds:[],sourceIndex:src
      };
    });

    // Unit rotation follows heat count but never affects league score rules.
    currentRound=((league100.setNo+league100.heatNo-2)%5)+1;

    // v1.0.3: each SET has one preassigned random map; all heats in that set reuse it.
    const nextMapId100=nextLeagueMap100();
    const mapResult100=applyMapDefinition770(nextMapId100,{reset:false});
    if(!mapResult100.ok){
      console.error("[v1.64.0] league map activation failed",mapResult100);
      league100.currentMapId=nextMapId100;
      league100.phase="bracket";
      return false;
    }

    // v1.64.0: keep bracket map id and race-engine map id identical.
    if(activeMapId770!==nextMapId100 || currentMap770().id!==nextMapId100){
      console.error("[v1.64.0] league map id mismatch",{requested:nextMapId100,active:activeMapId770,current:currentMap770().id});
      league100.phase="bracket";
      return false;
    }
    applyMapImage770(currentMap770());
    resetRound();
    clearMiniMap774();
    renderLeagueSide100();
    return true;
  }

  function beginLeagueSet100(){
    if(!league100||league100.winner||league100.phase==="racing")return;
    prepareLeaguePair100();
    league100.phase="racing";
    league100.heatNo=1;
    league100.heatScore={A:0,B:0};
    hideLeagueBoard100();
    if(!setupLeagueHeat100()){
      league100.phase="bracket";
      showLeagueBoard100();
      return;
    }
    start();
  }

  function continueLeagueHeat100(){
    if(!league100||league100.winner||league100.phase==="complete")return;
    league100.phase="racing";
    if(!setupLeagueHeat100())return;
    start();
  }

  function finishLeagueSet100(winner){
    const setNo=league100.setNo;
    const pair=leaguePair100();
    const result={
      setNo,
      A:pair.A,B:pair.B,
      winner,
      score:{...league100.heatScore}
    };
    league100.results.push(result);
    league100.teamScore[winner]++;

    if(league100.teamScore[winner]>=4){
      league100.winner=winner;
      league100.phase="complete";
    }else if(setNo<6){
      league100.setNo++;
      league100.phase="bracket";
      league100.heatNo=1;
      league100.heatScore={A:0,B:0};
      prepareLeaguePair100();
    }else if(setNo===6&&league100.teamScore.A===3&&league100.teamScore.B===3){
      league100.setNo=7;
      league100.phase="bracket";
      league100.heatNo=1;
      league100.heatScore={A:0,B:0};
      prepareLeaguePair100();
    }else{
      league100.winner=league100.teamScore.A>league100.teamScore.B?"A":"B";
      league100.phase="complete";
    }

    running=false;
    renderLeagueBoard100();
    renderLeagueSide100();
    showLeagueBoard100();
  }

  function awardLeagueHeat100(winner){
    if(!league100||league100.phase!=="racing"||league100.winner)return;
    if(winner!=="A"&&winner!=="B")return;

    league100.heatScore[winner]++;
    league100._lastHeatWinner101=winner;
    renderLeagueSide100();

    if(league100.heatScore[winner]>=2){
      finishLeagueSet100(winner);
      return;
    }

    league100.heatNo++;
    renderLeagueSide100();
    setTimeout(()=>continueLeagueHeat100(),180);
  }

  let teamAssignments={};
  let activeSourceIndexes=[];
  let matchMode="individual";
  const INDIVIDUAL_COLORS=["#ff4d4d","#4d8dff","#ffd84d","#39d46a","#66e3ff","#b06cff","#9aa0a6","#ff9f43"];
  let teamTotals={RED:0,BLUE:0};
  function isTeamMode(){return matchMode==="team";}
  let playerTournament={};
  let roundHistory=[];
  let tournamentHighlights=[];
  let roundTransitioning=false;
  let lastMasterResult=null;

  function clonePlain(v){ return JSON.parse(JSON.stringify(v)); }

  const STAT_EXPERIMENT_733={
    mode:"disabled-v8.20",
    note:"12-player roster uses fixed random attributes 70~90"
  };

  function engineCoreRules(){
    return {build:BUILD_ID,matchMode,observerCount:observerCountForMap791(),observerCountMax:observerCountForMap791(),playerCount:players.length||8,
      playerHitRadius:unitChassis764().hitRadius,stunMs:STUN_MS,invMs:INV_MS,
      cameraZoom:CAMERA_ZOOM,simHz:Math.round(1000/SIM_STEP_MS),
      playerCollision:false,safeZoneInvulnerability:true,
      baseSpeedMultiplier:1.566903319,
      statExperiment733:{...STAT_EXPERIMENT_733},
      statLabRoster739:[...names],
      personalityEngine:"Driver Personality Engine FINAL v7.59",
      unitEngine:"Unit Engine FINAL v7.69",
      mapEngine:"Active 9 Map Geometry · v7.943",
      currentMap770:{id:currentMap770().id,name:currentMap770().name,en:currentMap770().en},
      mapPoolSize770:MAP_POOL_770.length,
      mapGeometryReady770:MAP_POOL_770.filter(m=>m.geometryReady).length,
      currentUnit764:{...unitChassis764()},
      unitSpeedSpreadPct764:+unitSpeedSpread764().spreadPct.toFixed(3)};
  }

  function buildMasterMatchResult(){
    const ratings=aggregateMatchRatings();
    const ratingByIndex=new Map(ratings.map(x=>[x.index,x]));
    const winnerTeam=teamWinner();
    const teamRows=teamStandings();
    const playerResults=names.map((name,index)=>{
      const pt=playerTournament[index]||{rounds:[],total:0,team:teamAssignments[index]||null};
      const rows=roundHistory.flatMap(r=>(r.players||[]).filter(x=>x.index===index));
      const mr=ratingByIndex.get(index);
      return {index,name,team:pt.team,totalPoints:pt.total||0,
        matchRating:mr?.rating??null,grade:mr?ratingGrade(mr.rating):null,
        rounds:(pt.rounds||[]).map(rr=>{
          const x=rows.find(v=>v.time===rr.time)||rows.find(v=>v.rating===rr.rating)||null;
          return {round:rr.round,rank:rr.rank,points:rr.points,timeMs:rr.time,rating:rr.rating,
            collisions:x?.collisions??0,overtakes:x?.overtakes??0,avoids:x?.avoids??0,simpleDodges:x?.simpleDodges??0,
            leadMs:x?.leadMs??0,controlAttempts:x?.controlAttempts??0,
            controlSuccesses:x?.controlSuccesses??0,efficiency:x?.efficiency??0,
            raceForm:x?.raceForm??null,startReactionMs:x?.startReactionMs??null,
            startExecution:x?.startExecution??null,bestSector:x?.bestSector??null};
        })};
    });
    return {schema:"observer-fm-race-result@1",build:BUILD_ID,createdAt:new Date().toISOString(),
      rules:engineCoreRules(),match:{mode:matchMode,rounds:roundHistory.length,
        teamScores:isTeamMode()?{RED:teamTotals.RED,BLUE:teamTotals.BLUE}:null,winnerTeam,
        margin:isTeamMode()&&teamRows.length>1?Math.max(0,teamRows[0].score-teamRows[1].score):0},
      players:playerResults,
      unitStats769:unitStats769(),
      rounds:roundHistory.map(r=>({round:r.round,unit769:clonePlain(r.unit769||null),
        team:{...(r.team||{})},
        leaderChanges:r.leaderChanges||0,totalOvertakes:r.totalOvertakes||0,
        photoFinish:photoFinishArchive[r.round]?clonePlain(photoFinishArchive[r.round]):null,
        players:(r.players||[]).map(x=>({index:x.index,name:x.name,team:x.team,rank:x.rank,
          points:x.points,timeMs:x.time,rating:x.rating,collisions:x.collisions,deathPoints:clonePlain(x.deathPoints||[]),
          overtakes:x.overtakes,avoids:x.avoids,simpleDodges:x.simpleDodges||0,leadMs:x.leadMs,
          controlAttempts:x.controlAttempts,controlSuccesses:x.controlSuccesses,
          controlByType:clonePlain(x.controlByType||{}),passPlans:clonePlain(x.passPlans||{}),
          insideRate:x.insideRate,extremeInsideRate:x.extremeInsideRate,efficiency:x.efficiency,
          rankGain:x.rankGain,bestSector:x.bestSector,raceForm:x.raceForm,
          startReactionMs:x.startReactionMs,startExecution:x.startExecution,
          analytics749:clonePlain(x.analytics749||null)}))})),
      highlights:clonePlain(tournamentHighlights),analysis:buildMatchAnalysisReport()};
  }

  function publishMasterResult(){
    lastMasterResult=buildMasterMatchResult();
    window.__OBSERVER_FM_LAST_RESULT__=clonePlain(lastMasterResult);
    window.dispatchEvent(new CustomEvent("observerfm:matchcomplete",{detail:clonePlain(lastMasterResult)}));
    return lastMasterResult;
  }
  function createTeams(){
    if(league100?.phase==="racing"){
      const pair=leaguePair100();
      activeSourceIndexes=[pair.A,pair.B];
      teamAssignments={0:"RED",1:"BLUE"};
      return;
    }
    activeSourceIndexes=[0,1];
    teamAssignments={0:"RED",1:"BLUE"};
  }
  function initTournament(){
    currentRound=1;teamTotals={RED:0,BLUE:0};
    roundHistory=[];tournamentHighlights=[];lastMasterResult=null;
    window.__OBSERVER_FM_LAST_RESULT__=null;playerTournament={};
    activeSourceIndexes.forEach((src,i)=>{
      playerTournament[i]={name:names[src],team:teamAssignments[i]||null,total:0,rounds:[],sourceIndex:src};
    });
  }



  function leagueTeamColor105(p){
    if(league100?.phase==="racing"){
      if(p?.team==="BLUE")return "#4d8dff";
      if(p?.team==="RED")return "#ff4d4d";
    }
    return p?.color||teamColor(p?.team);
  }




  function teamLabel(team){return team==="RED"?"빨강팀":team==="BLUE"?"파랑팀":"개인전";}

  const TEAM_COLORS={RED:"#ff4d4d",BLUE:"#4d8dff"};
  function teamColor(team){return TEAM_COLORS[team]||"#ffffff";}
  function teamStandings(){
    if(!isTeamMode())return [];
    return ["RED","BLUE"].map(team=>({team,score:Number(teamTotals[team]||0)}))
      .sort((a,b)=>b.score-a.score||a.team.localeCompare(b.team));
  }
  function teamWinner(){
    if(!isTeamMode())return null;
    const rows=teamStandings();
    return rows.length>1&&rows[0].score===rows[1].score?null:rows[0]?.team||null;
  }
  function rebuildTournamentStandings(){
    const totals={RED:0,BLUE:0};const rebuilt={};
    activeSourceIndexes.forEach((src,i)=>{rebuilt[i]={name:names[src],team:teamAssignments[i]||null,total:0,rounds:[],sourceIndex:src};});
    for(const r of roundHistory){
      if(isTeamMode()){totals.RED+=Number(r.team?.RED||0);totals.BLUE+=Number(r.team?.BLUE||0);}
      for(const x of (r.players||[])){
        const row=rebuilt[x.index];if(!row)continue;
        row.team=x.team||null;row.total+=Number(x.points||0);
        row.rounds.push({round:r.round,rank:x.rank,points:x.points,time:x.time,rating:x.rating||0});
      }
    }
    teamTotals=totals;playerTournament=rebuilt;
  }




  function safeZones770(){
    return currentMap770().safeZones||{
      start:{x0:22.80,y0:124.30,x1:39.30,y1:140.80},
      goal:{x0:133.25,y0:14.25,x1:149.75,y1:30.75}
    };
  }

  function safeAt(x,y){
    const z=safeZones770();
    return (
      (x>=z.start.x0 && x<=z.start.x1 && y>=z.start.y0 && y<=z.start.y1) ||
      (x>=z.goal.x0 && x<=z.goal.x1 && y>=z.goal.y0 && y<=z.goal.y1)
    );
  }

  function pointNearPolyline771(x,y,points,width,extra=0){
    if(!Array.isArray(points)||points.length<2)return false;
    const r=Math.max(.25,width*.5+extra),r2=r*r;
    for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1],dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy||1;
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/L2));
      const qx=a[0]+dx*t,qy=a[1]+dy*t;
      const ex=x-qx,ey=y-qy;
      if(ex*ex+ey*ey<=r2)return true;
    }
    return false;
  }

  function genericCourseMask771(mapDef,x,y,extra=0){
    if(!mapDef)return false;
    const rr=mapDef.route770||[];
    const ww=mapDef.widths770||[];
    if(mapDef.id==='triple_diamond'&&Array.isArray(mapDef.destinyRoads813)){
      for(const road of mapDef.destinyRoads813){
        if(pointNearPolyline771(x,y,road,8.4,extra))return true;
      }
      return false; // v8.15: never authorize the retired single zig-zag route on Destiny Gate.
    }
    for(let i=0;i<rr.length-1;i++){
      const w=Number(ww[i]??ww[0]??10);
      if(pointNearPolyline771(x,y,[rr[i],rr[i+1]],w,extra))return true;
    }
    // v7.72: only road actually belonging to the approved track silhouette is legal.
    // Synthetic shortcut corridors from the old v7.71 draft are intentionally ignored.
    return false;
  }

  function makePlayers(){
    // v4.27 FINAL 8-RACER DIVERSITY: every heat gets a complete spread of stable
    // human racing-line signatures. They still start from the same physical point,
    // but immediately fan into distinct legal lines instead of forming a train.
    // Shuffle once per heat so the behavior belongs to the racer for this race, not a color slot.
    const laneSignatures=[
      {arch:"extremeInside",open:1.00,band:.88,wave:.10},
      {arch:"extremeInside",open:.82,band:.68,wave:-.08},
      {arch:"inside",open:.60,band:.46,wave:.16},
      {arch:"inside",open:.34,band:.24,wave:-.14},
      {arch:"adaptive",open:.08,band:.02,wave:.20},
      {arch:"variant",open:-.24,band:-.28,wave:-.22},
      {arch:"wideCut",open:-.50,band:-.52,wave:.14},
      {arch:"variant",open:-.72,band:-.72,wave:-.12}
    ];
    // v7.33 controlled stat experiment: fixed lane signatures per slot.
    // Do not reshuffle a hidden route advantage between test runs.
    const spawn770=mapStart770();
    return activeSourceIndexes.map((src,i)=>{
      const map810=currentMap770();
      const spawnI=(map810.id==='triple_diamond'&&Array.isArray(map810.dualStarts810))
        ? map810.dualStarts810[(i < Math.ceil(activeSourceIndexes.length/2)) ? 0 : 1]
        : spawn770;
      const dgStartIndex813=(map810.id==='triple_diamond')
        ? ((i < Math.ceil(activeSourceIndexes.length/2)) ? 0 : 1) : -1;
      const dgChoices813=(map810.id==='triple_diamond')
        ? [
            Math.random()<(map810.routeChoiceProbability813??.5)?-1:1, // lower split
            Math.random()<(map810.routeChoiceProbability813??.5)?-1:1  // upper split, independent re-choice
          ]
        : null;
      const laneSig=laneSignatures[i];
      const name=names[src];
      const pf=profiles[src];
      const stats=playerStats[src];
      const drivingStyle=drivingStyles[src];
      const paceNorm=stats.pace/100;
      const accelNorm=stats.acceleration/100;
      const enduranceNorm=stats.endurance/100;
      const consistency=stats.consistency/100;
      const luck=stats.luck/100;
      const formSpread=.0042*(1-consistency)+.0008; // v7.39 consistency controls race variance
      const formRoll=(Math.random()+Math.random()+Math.random()-1.5)/1.5;
      const raceForm=Math.max(.995,Math.min(1.005,1+formRoll*formSpread+(luck-.5)*.001));
      // v2.55: survival-minded racers trade distance for safety.
      const survivalNorm=Math.max(0,Math.min(1,
        (stats.avoidance+stats.stability+stats.riskControl+stats.prediction)/400));
      // v4.44 STAT FEEL: widen the real gameplay gap between specialists without adding hidden 1v1/8-player ratings.
      const wideDetourRace=false; // v4.67: deliberate exterior detours removed
      const wideDetourSide=Math.random()<.5?-1:1;
      // v4.16: all eight racers start from the exact same physical point.
      // Player-player collision is disabled, so overlapping starts are intentional.
      // Route separation must come from AI decisions after the gun, not spawn offsets.
      const startLane=0;
      return {
        index:i,sourceIndex:src,name,color:INDIVIDUAL_COLORS[i],profile:pf,stats,drivingStyle,team:teamAssignments[i]||null,spriteKey:RACER_KEYS[i],
        _dgStartIndex813:dgStartIndex813,_dgChoices813:dgChoices813,_dgPath813:null,_dgProg813:0,
        raceForm,survivalNorm,wideDetourRace,wideDetourSide,
        visionRadius:Math.max(50,Math.min(64,
          52.0+((stats.prediction-72)/27)*6.0+((stats.reaction-72)/27)*3.5+((stats.focus-72)/27)*3.5)),
        // v2.34: persistent route personality. Negative = safer/wider, positive = tighter inside.
        linePersonality:(
          drivingStyle.style==="apexHunter" ? .92 :
          drivingStyle.style==="attacker" ? .72 :
          drivingStyle.style==="opportunist" ? .58 :
          drivingStyle.style==="lineMaster" ? .42 :
          drivingStyle.style==="balanced" ? .08 :
          drivingStyle.style==="controller" ? -.28 :
          drivingStyle.style==="patient" ? -.62 :
          drivingStyle.style==="safeReader" ? -.82 : 0
        ),
        creativeRouteBudget:.52, creativeRouteUsed:0, creativeMode:0,
        // v4.193: persistent route archetype. Racers share the fast macro route but
        // deliberately prefer different legal micro-lines. This is stable per racer,
        // not frame-by-frame random jitter.
        routeArchetype:laneSig.arch,
        routeArchetypeStrength:.84+Math.random()*.16,
        // v4.194: opening-line identity. The fast opening macro-line remains known,
        // but racers no longer all stack on it: some climb to the extreme inside,
        // some hold a middle-high band, and some deliberately run a lower variant.
        openingLineBias:laneSig.open,
        openingLineStrength:.91+Math.random()*.09,
        creativeModeUntil:0, creativeCooldown:900+Math.random()*1200,
        creativeSide:Math.random()<.5?-1:1, creativePhase:Math.random()*Math.PI*2,
        routeIdentityBias:Math.max(-.78,Math.min(.78,(Math.random()*1.20-.60)+(drivingStyle.attack-drivingStyle.safety)*.42)),
        routeIdentityPhase:Math.random()*Math.PI*2,
        laneSignatureWave:laneSig.wave,
        // v4.02: personal route band. High route-reading racers stay closer to the
        // calculated racing line; lower route-reading / safety-oriented racers use
        // visibly different legal bands. Avoidance still has final authority.
        routeBand:(()=>{
          const read=stats.routeReading/100;
          const inside=stats.insideLine/100;
          const safety=(stats.riskControl+stats.stability)/200;
          const style=(drivingStyle.attack-drivingStyle.safety);
          const identity=(Math.random()*2-1)*(0.34-read*0.08);
          // v4.27: signature is the anchor; stats/style bend it without collapsing
          // eight racers back onto one mathematical optimum.
          return Math.max(-1.02,Math.min(1.02,laneSig.band*.66+identity+inside*.18+style*.20-safety*.10));
        })(),
        routeBandPhase:Math.random()*Math.PI*2,
        // v4.10: rare/high-skill extreme-inside attempts. Success can create a huge
        // shortest-line gain; a misjudged attempt deliberately crosses the lethal edge.
        extremeInsideActive:false, extremeInsideFail:false, extremeInsideUntil:0,
        extremeInsideCooldown:900+Math.random()*1200, extremeInsideSide:0,
        skimDodgeCooldown:0,
        liveRatingHistory:[],lastRatingSampleAt:0,
        x:spawnI.x, y:spawnI.y,
        steerX:1, steerY:0,
        seg:0,
        // Pace creates small but meaningful differences, not runaway gaps.
        speed: (
          9.18
          + paceNorm*.34
          + accelNorm*.14
          + enduranceNorm*.10
          + consistency*.06
          + (luck-.50)*.015
          + (Math.random()-.5)*(.012*(1-consistency))
        ) * 1.566903319,
        desiredOffset:(i-3.5)*0.40,
        stunUntil:0, invUntil:0, collisionLockUntil:0,
        hitFxUntil:0, visualAngle:0, prevX:spawnI.x, prevY:spawnI.y, simPrevX:spawnI.x, simPrevY:spawnI.y,
        // v4.69: brief tolerance for borderline upper-left corner exits.
        outsideGrace69Since:0,
        sectorIndex:0, sectorStartMs:0, sectorTimes:[],
        humanMode:0, humanModeUntil:0, humanPhase:Math.random()*Math.PI*2,
        decisionErrorUntil:0, textWidth:0,
        hits:0, dead:false, done:false, finishTime:null,
        controlMode:"normal", controlUntil:0,
        backconStyle:"none",
        controlCooldown: 2400 + Math.random()*3600,
        reactiveControl:false,
        reactiveThreatId:-1,
        reactiveControlCooldown:1800+Math.random()*2200,
        controlSuccess:true,
        controlQuality:1,
        controlMistakeSide:0,
        modeStart:0,
        lastProgress:0,
        lastAdvanceAt:0,
        lastX:spawnI.x,
        lastY:spawnI.y,
        avoidDecisionUntil:0,
        avoidWillDodge:true,
        avoidThreatId:-1,
        avoidPlanOffset:0,
        avoidPlanSpeedMul:1,
        avoidPlanUntil:0,
        avoidPlanRisk:0,
        avoidLastSide:0,
        avoidSideLockUntil:0,
        avoidRecoverUntil:0,
        avoidRecoverOffset:0,
        avoidRecoverStart:0,
        avoidExitSide:0,
        avoidExitUntil:0,
        avoidClearSince:0,
        // v4.17 human-like live controller: short-lived mouse-style inputs,
        // reaction delay and repeated re-reads of the visible observer field.
        liveEvadeUntil:0, liveEvadeNextThink:0, liveEvadeOffset:0, liveEvadeSpeed:1,
        liveEvadeSide:0, liveEvadePhase:0, liveEvadeDanger:0, liveEvadeThreat:-1,
        liveEvadeAction:"none",
        evadeRevisionThreat:-1, evadeRevisionVx:0, evadeRevisionVy:0, evadeRevisionAt:0, evadeRevisionCooldown:0,
        // v4.28 survival balance: hold a safe escape lane briefly after a threat clears
        // instead of snapping straight back into the racing line / next observer.
        survivalRecoverUntil:0, survivalRecoverStart:0, survivalRecoverOffset:0,
        // v4.33 rejoin safety gate: do not snap back into the apex while the next
        // observer corridor is still closing.
        survivalRejoinClearSince:0, survivalRejoinHoldUntil:0, survivalRejoinLastRisk:0,
        // v4.34 boxed/blocked escape: remember one committed breakout corridor so
        // front-left-right pressure does not cause panic oscillation or repeated stops.
        breakoutUntil:0, breakoutOffset:0, breakoutSpeed:1, breakoutSide:0, breakoutScore:0,
        // v4.20 Virtual Mouse Human Controller. Movement follows a held click target
        // until the next human-timed command instead of consuming a fresh perfect target every tick.
        mouseTargetX:30.77, mouseTargetY:144.00, mouseNextThink:0, mouseCommandUntil:0,
        mouseClickSeq:0, mouseClickLog:[], mouseMode:"race", mouseLastClickAt:0,
        // v4.59.9 AI DEATH BLACKBOX: 5-second rolling decision/perception trace.
        aiBlackbox:[], aiBlackboxNextSample:0,
        // v4.26 persistent human click rhythm. Each racer keeps a recognizable
        // command tempo, click reach and risk/rejoin character instead of sharing
        // one global mouse cadence. Stable for the race; never frame-randomized.
        mouseRhythm:({apexHunter:.88,safeReader:1.12,attacker:.84,lineMaster:.94,balanced:1.00,controller:.91,patient:1.15,opportunist:.87}[drivingStyle.style]||1)*(0.96+Math.random()*.08),
        mouseReach:({apexHunter:1.05,safeReader:.91,attacker:1.07,lineMaster:1.02,balanced:.97,controller:.94,patient:.90,opportunist:1.04}[drivingStyle.style]||1)*(0.985+Math.random()*.03),
        mouseDangerTempo:({apexHunter:.92,safeReader:.88,attacker:.84,lineMaster:.94,balanced:1.00,controller:.86,patient:1.05,opportunist:.87}[drivingStyle.style]||1),
        mouseRejoinBias:identityOf({drivingStyle}).rejoin,
        // v4.21 perception: only personally seen observers may drive AI decisions.
        perceivedObservers:new Map(), perceptionLastUpdate:0, perceptionFocusId:-1,
        // v4.37 humanized perception. Stable personal bias + repeat-sighting confidence
        // create believable late/rough reads without frame-randomized fake deaths.
        perceptionBiasX:(Math.random()-.5)*0.34, perceptionBiasY:(Math.random()-.5)*0.34,
        perceptionTrackSeed:Math.random()*1000,
        // v4.23 human reaction pipeline: detection -> recognition -> decision -> click.
        reactionThreatId:-1, reactionDangerActive:false, mouseReactionReadyAt:0,
        lastReactionDelayMs:0, lastRecognitionDelayMs:0,
        aiDiagRedundantClicks:0, aiDiagLastMode:"race", aiDiagModeChanges:0,
        variantMode:0,
        variantUntil:0,
        variantCooldown:6500+Math.random()*7000,
        variantSide:0,
        variantStrength:0,
        tacticalRisk:0,
        tacticalRiskUntil:0,
        tacticalRiskCooldown:900+Math.random()*900,
        situationDecisionUntil:0,
        situationDecisionOffset:0,
        packPlanOffset:0,
        packPlanUntil:0,
        // v4.66 MULTI-CAR RACING LINE 2.0: short commitment prevents pack weaving.
        multiCarLineOffset:0,
        multiCarLineUntil:0,
        multiCarLineMode:"solo",
        passPlanMode:0,       // 0 none, 1 inside attack, 2 outside setup, 3 wait-and-cut
        passPlanUntil:0,
        passPlanCooldown:700+Math.random()*900,
        passPlanOffset:0,
        passPlanSpeedMul:1,
        passTargetId:-1,
        startLaunchMul:0,
        startLaunchUntil:0,
        startReactionMs:0,
        startExecution:1,
        // v4.48 START AI: same physical spawn, different committed opening decisions.
        startLineTarget:0, startLineCommit:0, startDecisionUntil:0, startBurstPhase:0,
        livePressure:0,
        newPB:false,
        newMapRecord:false,
        clutchDecisionUntil:0,
        clutchLineOffset:0,
        clutchSpeedMul:1,
        decisionLockUntil:0,
        decisionLockOffset:0,
        comboDodgeUntil:0,
        comboDodgeOffset:0,
        comboDodgePhase:0,
        comboDodgeSide:0,
        preCornerUntil:0,
        preCornerOffset:0,
        finalCornerUntil:0,
        finalCornerOffset:0,
        shockAvoidUntil:0,
        shockAvoidOffset:0,
        marseilleUntil:0,
        marseilleSide:0,
        resumeEaseUntil:0,
        // v2.54: uninterrupted running builds a small momentum advantage.
        // A stop/reverse/collision resets it, so cleaner runs edge ahead on equal lines.
        continuousRunMs:0,
        continuousRunMul:1,
        // v2.60: collision-free confidence. It affects route bravery, not raw speed.
        cleanConfidenceMs:0,
        cleanConfidence:0,
        match:{
          collisions:0,stops:0,avoids:0,simpleDodges:0,packDodges:0,overtakes:0,leadMs:0,
          nearMisses:0,extremeNearMisses:0,lastNearMissAt:0,dangerExposureMs:0,
          deathPoints:[],
          controlAttempts:0,controlSuccesses:0,
          controlByType:{
            zigzag:{attempts:0,successes:0},
            diagonal:{attempts:0,successes:0},
            spin360:{attempts:0,successes:0},
            marseille:{attempts:0,successes:0},
            backcon:{attempts:0,successes:0},
            stopcon:{attempts:0,successes:0},
            wide:{attempts:0,successes:0}
          },
          passPlans:{inside:0,outside:0,waitCut:0,straight:0},
          lineSamples:0,insideHits:0,extremeInsideHits:0,
          trace:[],lastTraceAt:0,
          maxRankGain:0,maxRankLoss:0,startRank:i+1,bestRank:i+1,worstRank:i+1,
          distance:0,lastX:route[0][0],lastY:route[0][1]
        },
        linePlanOffset:0,
        linePlanUntil:0
      };
    });
  }

  function pickObserverLeg(o){
    const legSeconds=OBS_MOVE_MS/1000;
    const legDistance=o.speed*legSeconds;
    const margin=3.5;

    // Choose a straight heading whose 10-second endpoint remains inside the map.
    // This guarantees a visibly large movement leg instead of circling locally.
    let angle=0, found=false;
    for(let tries=0;tries<40;tries++){
      angle=Math.random()*Math.PI*2;
      const ex=o.x+Math.cos(angle)*legDistance;
      const ey=o.y+Math.sin(angle)*legDistance;
      if(ex>=margin && ex<=MAP_W-margin && ey>=margin && ey<=MAP_H-margin){
        found=true;
        break;
      }
    }

    if(!found){
      // Near awkward edges, aim roughly toward a distant interior point.
      const tx=MAP_W*(0.25+Math.random()*0.50);
      const ty=MAP_H*(0.25+Math.random()*0.50);
      angle=Math.atan2(ty-o.y,tx-o.x);
    }

    o.vx=Math.cos(angle)*o.speed;
    o.vy=Math.sin(angle)*o.speed;
  }


  let observerDensityZones=[];
  function makeObserverDensityZones(){
    const count=2+Math.floor(Math.random()*2);
    const zones=[];
    for(let i=0;i<count;i++){
      zones.push({
        x:18+Math.random()*(MAP_W-36),
        y:16+Math.random()*(MAP_H-32),
        rx:20+Math.random()*20,
        ry:16+Math.random()*18,
        strength:.28+Math.random()*.18,
        trap:false
      });
    }
    // v3.1 옵저버 함정 구간: 매 라운드 실제 코스 위 1~2곳에 작은 밀집 구간.
    // 옵저버는 스폰 후 기존처럼 독립적으로 랜덤 이동하므로 코스를 따라다니지 않는다.
    const trapCount=1+(Math.random()<.45?1:0);
    const trapCandidates=[.16,.28,.42,.56,.70,.84,.94]
      .map(r=>Math.max(0,Math.min(route.length-1,Math.round((route.length-1)*r))));
    for(let i=0;i<trapCount;i++){
      const ri=trapCandidates[Math.floor(Math.random()*trapCandidates.length)];
      const pt=route[ri];
      zones.push({
        x:pt[0],y:pt[1],
        rx:7.5+Math.random()*3.5,ry:6.0+Math.random()*3.0,
        strength:.72,trap:true
      });
    }
    return zones;
  }
  function densitySpawnPoint(){
    // Most observers remain globally random. A bounded share is biased into
    // 2–3 random zones each round, so the dangerous area changes without
    // turning observers into course-followers.
    if(observerDensityZones.length && Math.random()<.48){
      const traps=observerDensityZones.filter(z=>z.trap);
      const z=(traps.length&&Math.random()<.34)
        ? traps[Math.floor(Math.random()*traps.length)]
        : observerDensityZones[Math.floor(Math.random()*observerDensityZones.length)];
      for(let tries=0;tries<10;tries++){
        const a=Math.random()*Math.PI*2, rr=Math.sqrt(Math.random());
        const x=z.x+Math.cos(a)*z.rx*rr;
        const y=z.y+Math.sin(a)*z.ry*rr;
        if(x>3.5&&x<MAP_W-3.5&&y>3.5&&y<MAP_H-3.5) return {x,y};
      }
    }
    return {x:3.5+Math.random()*(MAP_W-7),y:3.5+Math.random()*(MAP_H-7)};
  }


  function startSafetyPoints816(mapDef=currentMap770()){
    if(mapDef?.id==='triple_diamond'&&Array.isArray(mapDef.dualStarts810))
      return mapDef.dualStarts810.map(s=>({x:s.x,y:s.y}));
    if(mapDef?.start)return [{x:mapDef.start.x,y:mapDef.start.y}];
    const s=mapStart770();return [{x:s.x,y:s.y}];
  }
  function startForwardRoads816(mapDef=currentMap770()){
    if(mapDef?.id==='triple_diamond'&&Array.isArray(mapDef.destinyTopology815?.startRoads))
      return mapDef.destinyTopology815.startRoads;
    if(Array.isArray(mapDef?.route770)&&mapDef.route770.length>1)
      return [mapDef.route770.slice(0,Math.min(6,mapDef.route770.length))];
    return [];
  }
  function inStartObserverExclusion816(x,y,mapDef=currentMap770()){
    const radius=mapDef?.startObserverExclusionRadius816??13.0, r2=radius*radius;
    for(const s of startSafetyPoints816(mapDef)){
      const dx=x-s.x,dy=y-s.y;
      if(dx*dx+dy*dy<=r2)return true;
    }
    for(const road of startForwardRoads816(mapDef)){
      if(pointNearPolyline771(x,y,road,7.2,5.6))return true;
    }
    return false;
  }
  function startProtectionActive816(p,now=gameNow()){
    return !!p && now<(Number(p._startProtectionUntil816)||0);
  }
  function startAiBoost816(p,now=gameNow()){
    return !!p && now<(Number(p._startAiBoostUntil816)||0);
  }
  
  let gauntletMode190=false;
  let gauntletWaveIndex190=0;
  let gauntletWaveStarted190=0;
  let gauntletWaveProg190=0;
  let gauntletLastHud190=0;
  const GAUNTLET_WAVES_190=[
    "1마리 정면",
    "2마리 엇갈림",
    "4마리 군집",
    "스탑 옵저버",
    "좌우 동시 접근",
    "연속 군집"
  ];

  const gauntletStats190={
    attempts:0,deaths:0,clears:0,wavesPassed:0,
    lastDeath:null
  };

  const gauntletAnalytics191={
    attemptStartedAt:0,progressSamples:0,progressSum:0,bestProgress:0,
    survivalTimeTotalMs:0,completedAttempts:0,
    avoidAttempts:0,avoidSuccess:0,avoidFail:0,
    reactionTimeTotalMs:0,reactionSamples:0,
    predictedGapMin:Infinity,predictedGapTotal:0,predictedGapSamples:0,
    lateralTotal:0,lateralSamples:0,lateralMax:0,directionChanges:0,zigzags:0,slowdowns:0,emergencyEscapes:0,safeCorridors:0,corridorSwitches:0,emergencyFallbacks:0,edgeCorridorSelections:0,emergencyEdgeCorridors198:0,reserveTotal:0,reserveSamples:0,specialControls197:0,specialAttempts197:0,specialInterrupted197:0,backControls197:0,spin360s197:0,chainedSuccess1100:0,chainedFail1100:0,futureOptionsTotal1100:0,futureOptionsSamples1100:0,executionPlans1101:0,executionReplans1101:0,executionCompletions1101:0,stateChanges1102:0,executionPartialReplans1103:0,executionFailures1104:0,executionStageTimeouts1105:0,microDodges1107:0,microDodgeResumes1107:0,executionInvalidSudden1108:0,executionInvalidSideFlip1108:0,executionInvalidCrowd1108:0,executionTimedOut1108:0,stallRescues1110:0,denseExecutionStarts1111:0,denseEmergencyOverrides1111:0,executionOverlayBridges1113:0,executionOverlayResumes1113:0,executionOverlayActive1115:0,executionOverlayAccountingError1115:0,emergencyEscapes:0,
    wave:GAUNTLET_WAVES_190.map(name=>({name,attempts:0,passed:0,deaths:0})),
    reasons:{"위험 미감지":0,"경로 선택 실패":0,"이동속도 부족":0,"연속 위협 대응 실패":0,"옵저버 예측 실패":0,"충돌판정 불일치":0,"가장자리 고립":0,"통로 선택 지연":0,"Emergency 경로 실패":0,"Execution 연속위협 실패":0,"Micro-Dodge 복합위협 실패":0,"Micro-Dodge 경로 실패":0,"Execution 경로 실패":0,"특이 컨트롤 중 충돌":0,"자유주행 위험 진입":0,"Execution Overlay 복합위협 실패":0,"Execution Overlay 경로 실패":0,"기타":0},
    deathLog:[]
  };

  function pct191(v){return `${(Number(v)||0).toFixed(1)}%`;}



  function classifyDeath191(p,dbg,actual,nearbyCount){
    const pred=Number(dbg?.predMin);
    const sensor=Number(dbg?.sensorNearest);
    const action=String(dbg?.action||"");

    if(Number.isFinite(sensor)&&sensor<4.5&&(!action||action==="free-drive"))return "위험 미감지";
    if(Number.isFinite(pred)&&pred>20&&Number.isFinite(sensor)&&sensor<6)return "옵저버 예측 실패";
    if(Number.isFinite(pred)&&pred>4.0&&actual<1.5)return "충돌판정 불일치";
    if(Number.isFinite(pred)&&pred>3.2&&actual<2.0)return "옵저버 예측 실패";
    if(nearbyCount>=5)return "연속 위협 대응 실패";
    if(Math.abs(Number(p._lane120)||0)>2.35 && action==="safe-corridor")return "가장자리 고립";
    if(action==="safe-corridor" && Number.isFinite(pred) && pred<1.4)return "통로 선택 지연";
    if(Math.abs(Number(p._laneVelSec181)||0)<.35 && action.includes("survival"))return "이동속도 부족";
    if(action==="execution-overlay-bridge" && nearbyCount>=4)return "Execution Overlay 복합위협 실패";
    if(action==="execution-overlay-bridge")return "Execution Overlay 경로 실패";
    if(action==="emergency-state" && actual<.85)return "Emergency 경로 실패";
    if(action==="micro-dodge" && nearbyCount>=4)return "Micro-Dodge 복합위협 실패";
    if(action==="micro-dodge" && actual<.85)return "Micro-Dodge 경로 실패";
    if(action==="execution-state" && nearbyCount>=4)return "Execution 연속위협 실패";
    if(action==="execution-state" && actual<.95)return "Execution 경로 실패";
    if(action==="special-control")return "특이 컨트롤 중 충돌";
    if(action==="free-drive" && nearbyCount>=3)return "자유주행 위험 진입";
    if(action.includes("survival")||action.includes("escape")||action.includes("corridor")||action.includes("veto"))return "경로 선택 실패";
    return "기타";
  }



  function recordGauntletProgress191(){
    if(!gauntletMode190||!players.length)return;
    let sum=0,n=0;
    for(const p of players){
      if(!p)continue;
      const prog=Math.max(0,Math.min(1,currentProgress(p)/(routeLength||1)));
      sum+=prog;n++;gauntletAnalytics191.bestProgress=Math.max(gauntletAnalytics191.bestProgress,prog);
      const lat=Math.abs(Number(p._lane120)||0);
      gauntletAnalytics191.lateralTotal+=lat;gauntletAnalytics191.lateralSamples++;
      gauntletAnalytics191.lateralMax=Math.max(gauntletAnalytics191.lateralMax,lat);
      const s=Math.sign(Number(p._laneVelSec181)||0),prev=Math.sign(Number(p._gaPrevLatSign191)||0);
      if(s&&prev&&s!==prev)gauntletAnalytics191.directionChanges++;
      if(s)p._gaPrevLatSign191=s;
    }
    if(n){gauntletAnalytics191.progressSamples++;gauntletAnalytics191.progressSum+=sum/n;}
  }


  function recordAvoidDecision191(p,decision,now){
    if(!gauntletMode190||!decision)return;

    const sensor=immediateSensorCheck192(p,9.5);
    const threatNow=sensor.count>0&&sensor.nearest<6.5;

    if(threatNow&&!p._gaThreatFirstSeen192){
      p._gaThreatFirstSeen192=now;
      p._gaFirstCommandRecorded192=false;
    }

    const laneDelta=Math.abs((Number(decision.lane)||0)-(Number(p._lane120)||0));
    const evasiveCommand=decision.dangerous||laneDelta>.15||Number(decision.speedMul)<.96;

    if(threatNow&&p._gaThreatFirstSeen192&&!p._gaFirstCommandRecorded192&&evasiveCommand){
      gauntletAnalytics191.reactionTimeTotalMs+=Math.max(0,now-p._gaThreatFirstSeen192);
      gauntletAnalytics191.reactionSamples++;
      p._gaFirstCommandRecorded192=true;
    }

    if(!threatNow){
      p._gaThreatFirstSeen192=0;
      p._gaFirstCommandRecorded192=false;
    }

    if(decision.dangerous){
      gauntletAnalytics191.avoidAttempts++;
      if(decision.corridor195){
        gauntletAnalytics191.safeCorridors++;
        const fo1100=Number(decision.futureOptions);
        if(Number.isFinite(fo1100)){
          gauntletAnalytics191.futureOptionsTotal1100+=fo1100;
          gauntletAnalytics191.futureOptionsSamples1100++;
          // v1.10.1: chained success/failure is verified by actual survival,
          // not by predicted availability alone.
        }
        const rr=Number(decision.reserve);
        if(Number.isFinite(rr)){
          gauntletAnalytics191.reserveTotal+=rr;
          gauntletAnalytics191.reserveSamples++;
          if(rr<.18)gauntletAnalytics191.edgeCorridorSelections++;
        }
        if(decision.edgeEmergency)gauntletAnalytics191.emergencyEdgeCorridors198++;
      }
      if(decision.emergency193){
        gauntletAnalytics191.emergencyEscapes++;
      }
      gauntletAnalytics191.corridorSwitches=players.reduce((sum,q)=>sum+(q._safeCorridorSwitches195||0),0);
      p._gaDangerSeen191=1;

      const pg=Number(decision.minGap);
      if(Number.isFinite(pg)){
        gauntletAnalytics191.predictedGapMin=Math.min(gauntletAnalytics191.predictedGapMin,pg);
        gauntletAnalytics191.predictedGapTotal+=pg;
        gauntletAnalytics191.predictedGapSamples++;
      }
      if(Number(decision.speedMul)<.95)gauntletAnalytics191.slowdowns++;

      const action=String(p.liveEvadeAction||"");
      if(action.includes("zig")||action.includes("doublemove")||action.includes("cutback"))gauntletAnalytics191.zigzags++;
    }else if(!threatNow&&p._gaDangerSeen191){
      gauntletAnalytics191.avoidSuccess++;
      p._gaDangerSeen191=0;
    }
  }


  function finishGauntletAttempt191(now){
    const start=gauntletAnalytics191.attemptStartedAt||now;
    gauntletAnalytics191.survivalTimeTotalMs+=Math.max(0,now-start);
    gauntletAnalytics191.completedAttempts++;
    gauntletAnalytics191.attemptStartedAt=now;
  }

  function resetGauntletAnalytics191(){
    Object.assign(gauntletAnalytics191,{
      attemptStartedAt:gameNow(),progressSamples:0,progressSum:0,bestProgress:0,
      survivalTimeTotalMs:0,completedAttempts:0,avoidAttempts:0,avoidSuccess:0,avoidFail:0,
      reactionTimeTotalMs:0,reactionSamples:0,predictedGapMin:Infinity,predictedGapTotal:0,predictedGapSamples:0,
      lateralTotal:0,lateralSamples:0,lateralMax:0,directionChanges:0,zigzags:0,slowdowns:0,
      wave:GAUNTLET_WAVES_190.map(name=>({name,attempts:0,passed:0,deaths:0})),deathLog:[]
    });
    for(const k of Object.keys(gauntletAnalytics191.reasons))gauntletAnalytics191.reasons[k]=0;
    gauntletStats190.attempts=gauntletStats190.deaths=gauntletStats190.clears=gauntletStats190.wavesPassed=0;gauntletStats190.lastDeath=null;
    gauntletAnalytics191.executionLifecycle1105={CREATED:0,COMPLETED:0,EMERGENCY_INTERRUPTED:0,STATE_INTERRUPTED:0,REPLACED:0,PLAYER_DIED:0,TIMEOUT:0,INVALIDATED:0};
    gauntletAnalytics191.executionTrace1105=[];
    gauntletAnalytics191.emergencyTrace1105={detected:0,requested:0,entered:0,applied:0,collided:0,detectToEnterTotalMs:0,detectToEnterSamples:0,enterToApplyTotalMs:0,enterToApplySamples:0};
    renderGauntletAnalytics191();renderGauntletHud190(gameNow());
  }

  function renderGauntletAnalytics191(){
    const a=gauntletAnalytics191,attempts=gauntletStats190.attempts||0,clears=gauntletStats190.clears||0,deaths=gauntletStats190.deaths||0;
    const completed=a.completedAttempts||Math.max(1,clears+deaths),avgTime=completed?a.survivalTimeTotalMs/completed/1000:0;
    const avgProg=a.progressSamples?a.progressSum/a.progressSamples*100:0,clearRate=attempts?clears/attempts*100:0;
    const avoidDen=a.avoidSuccess+a.avoidFail,avoidRate=avoidDen?a.avoidSuccess/avoidDen*100:0;
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    set("gaKpiAttempts191",attempts);set("gaKpiClears191",clears);set("gaKpiDeaths191",deaths);set("gaKpiClearRate191",pct191(clearRate));
    set("gaKpiAvgTime191",`${avgTime.toFixed(1)}s`);set("gaKpiAvgProg191",pct191(avgProg));set("gaKpiBestProg191",pct191(a.bestProgress*100));set("gaKpiAvoidRate191",pct191(avoidRate));

    const waveHost=document.getElementById("gauntletWaveTable191");
    if(waveHost)waveHost.innerHTML='<table class="gauntlet-wave-table-191"><thead><tr><th>웨이브</th><th>시도</th><th>통과</th><th>사망</th><th>통과율</th></tr></thead><tbody>'+
      a.wave.map(w=>`<tr><td>${w.name}</td><td>${w.attempts}</td><td>${w.passed}</td><td>${w.deaths}</td><td>${pct191(w.attempts?w.passed/w.attempts*100:0)}</td></tr>`).join("")+'</tbody></table>';

    const aiHost=document.getElementById("gauntletAiStats191");
    if(aiHost){
      const predAvg=a.predictedGapSamples?a.predictedGapTotal/a.predictedGapSamples:0,reactAvg=a.reactionSamples?a.reactionTimeTotalMs/a.reactionSamples:0;
      const latAvg=a.lateralSamples?a.lateralTotal/a.lateralSamples:0;
      const items=[["회피 시도",a.avoidAttempts],["회피 성공",a.avoidSuccess],["회피 실패",a.avoidFail],["평균 반응시간",`${reactAvg.toFixed(0)}ms`],["평균 예측 안전거리",predAvg.toFixed(2)],["최저 예측 안전거리",Number.isFinite(a.predictedGapMin)?a.predictedGapMin.toFixed(2):"-"],["평균 좌우 이동",latAvg.toFixed(2)],["최대 좌우 이동",a.lateralMax.toFixed(2)],["방향 전환",a.directionChanges],["지그재그/변칙",a.zigzags],["감속 횟수",a.slowdowns],["Safe Corridor",a.safeCorridors||0],["Corridor 변경",a.corridorSwitches||0],["Emergency Fallback",a.emergencyFallbacks||0],["가장자리 Corridor",a.edgeCorridorSelections||0],["긴급 가장자리",a.emergencyEdgeCorridors198||0],["평균 Escape Reserve",a.reserveSamples?(a.reserveTotal/a.reserveSamples).toFixed(2):"-"],["특이 컨트롤 시도",a.specialAttempts197||0],["특이 컨트롤 완료",a.specialControls197||0],["특이 완료율",a.specialAttempts197?((a.specialControls197/a.specialAttempts197)*100).toFixed(1)+"%":"-"],["중도 취소",a.specialInterrupted197||0],["빽컨 완료",a.backControls197||0],["360도컨 완료",a.spin360s197||0],["연속 회피 성공",a.chainedSuccess1100||0],["연속 회피 실패",a.chainedFail1100||0],["평균 다음 탈출경로",a.futureOptionsSamples1100?(a.futureOptionsTotal1100/a.futureOptionsSamples1100).toFixed(2):"-"],["Execution Plan",(a.executionLifecycle1105?.CREATED??a.executionPlans1101??0)],["Execution 재계획",a.executionReplans1101||0],["부분 재계획",a.executionPartialReplans1103||0],["Execution 완료",(a.executionLifecycle1105?.COMPLETED??a.executionCompletions1101??0)],["Execution 실패",a.executionFailures1104||0],["단계 Timeout",a.executionStageTimeouts1105||0],["Execution 완료율",(a.executionLifecycle1105?.CREATED??a.executionPlans1101)?((((a.executionLifecycle1105?.COMPLETED??a.executionCompletions1101??0)/(a.executionLifecycle1105?.CREATED??a.executionPlans1101))*100).toFixed(1)+"%"):"-"],["AI 상태 전환",a.stateChanges1102||0],["Micro-Dodge",a.microDodges1107||0],["Execution 복귀",a.microDodgeResumes1107||0],["INVALID sudden",a.executionInvalidSudden1108||0],["부분재계획 side-flip",a.executionInvalidSideFlip1108||0],["부분재계획 crowd",a.executionInvalidCrowd1108||0],["Execution TIMEOUT",a.executionTimedOut1108||0],["Stall Rescue",a.stallRescues1110||0],["4+ Execution 우선",a.denseExecutionStarts1111||0],["4+ 긴급 강제전환",a.denseEmergencyOverrides1111||0],["Execution Overlay Bridge",a.executionOverlayBridges1113||0],["Overlay 종료 후 Execution 지속",a.executionOverlayResumes1113||0],["현재 Overlay 실행중",a.executionOverlayActive1115||0],["Overlay 집계 오류",a.executionOverlayAccountingError1115||0]];
      aiHost.innerHTML=items.map(([k,v])=>`<div class="gauntlet-stat-box-191"><span>${k}</span><b>${v}</b></div>`).join("");
    }

    const reasonHost=document.getElementById("gauntletDeathReasons191");
    if(reasonHost)reasonHost.innerHTML=Object.entries(a.reasons).map(([k,v])=>`<div class="gauntlet-stat-box-191"><span>${k}</span><b>${v}</b></div>`).join("");


    const lifeHost=document.getElementById("gauntletExecutionLifecycle1105");
    if(lifeHost){
      ensureTraceAnalytics1105();
      const l=a.executionLifecycle1105||{};
      lifeHost.innerHTML=[["CREATED",l.CREATED||0],["COMPLETED",l.COMPLETED||0],["EMERGENCY_INTERRUPTED",l.EMERGENCY_INTERRUPTED||0],["STATE_INTERRUPTED",l.STATE_INTERRUPTED||0],["REPLACED",l.REPLACED||0],["PLAYER_DIED",l.PLAYER_DIED||0],["TIMEOUT",l.TIMEOUT||0],["INVALIDATED",l.INVALIDATED||0]].map(([k,v])=>`<div class="gauntlet-stat-box-191"><span>${k}</span><b>${v}</b></div>`).join("");
    }

    const traceHost=document.getElementById("gauntletExecutionTrace1105");
    if(traceHost){
      traceHost.innerHTML=(a.executionTrace1105||[]).map(r=>`<tr><td>${r.id}</td><td>${r.event}</td><td>${r.phase}</td><td>${r.elapsed}ms</td><td>${r.reason}</td><td>${r.player}</td><td>${r.progress}%</td></tr>`).join("");
    }

    const emHost=document.getElementById("gauntletEmergencyTrace1105");
    if(emHost){
      const e=a.emergencyTrace1105||{};
      const dte=e.detectToEnterSamples?e.detectToEnterTotalMs/e.detectToEnterSamples:0;
      const eta=e.enterToApplySamples?e.enterToApplyTotalMs/e.enterToApplySamples:0;
      emHost.innerHTML=[["위험 감지",e.detected||0],["Emergency 요청",e.requested||0],["Emergency 진입",e.entered||0],["회피 벡터 적용",e.applied||0],["Emergency 중 충돌",e.collided||0],["감지→진입",`${dte.toFixed(1)}ms`],["진입→적용",`${eta.toFixed(1)}ms`]].map(([k,v])=>`<div class="gauntlet-stat-box-191"><span>${k}</span><b>${v}</b></div>`).join("");
    }

    const logHost=document.getElementById("gauntletDeathLog191");
    if(logHost)logHost.innerHTML=a.deathLog.map((d,i)=>`<tr><td>${i+1}</td><td>${d.wave}</td><td>${d.reason}</td><td>${d.action}</td><td>${d.predMin}</td><td>${d.sensorNearest??"-"}</td><td>${d.actual}</td><td>${d.nearby}</td><td>${d.lane}</td><td>${d.progress}%</td><td>${d.speedMul}</td></tr>`).join("");
  }

  function openGauntletAnalytics191(){const e=document.getElementById("gauntletAnalytics191");if(e)e.classList.remove("hidden");renderGauntletAnalytics191();}
  function closeGauntletAnalytics191(){const e=document.getElementById("gauntletAnalytics191");if(e)e.classList.add("hidden");}


  function spawnGauntletObservers190(){
    const arr=[];
    const baseSpeed=9.72*OBS_SPEED_RATIO;
    for(let i=0;i<14;i++){
      arr.push({
        id:i,x:3,y:3,vx:0,vy:0,speed:baseSpeed,
        phase:"move",phaseUntil:1e15,cycleOffset:0,
        pattern712:"free",_gauntlet190:true,_gauntletActive190:false
      });
    }
    return arr;
  }

  function gauntletLeader190(){
    const alive=players.filter(p=>p&&!p.done&&!p.dead);
    if(!alive.length)return players[0]||null;
    return alive.slice().sort((a,b)=>currentProgress(b)-currentProgress(a))[0];
  }

  function gauntletConfigureObserver190(o,info,prog,lane,now,dt,stopped=false){
    const q=smoothFrame120(info,Math.max(0,Math.min(info.total,prog)));
    const nx=-q.uy,ny=q.ux;
    const nxPos=q.x+nx*lane,nyPos=q.y+ny*lane;

    const sec=Math.max(.001,dt/1000);
    const ox=Number(o.x)||nxPos,oy=Number(o.y)||nyPos;
    o.vx=stopped?0:(nxPos-ox)/sec;
    o.vy=stopped?0:(nyPos-oy)/sec;
    o.x=nxPos;o.y=nyPos;
    o.phase=stopped?"stop":"move";
    o.phaseUntil=now+10000;
    o._gauntletActive190=true;
  }

  function gauntletStep190(now,dt){
    if(!gauntletMode190||!players.length||!observers.length)return;

    const lead=gauntletLeader190();
    if(!lead)return;

    const info=pathInfo120(lead);
    const prog=Number(info.prog)||0;

    if(!gauntletWaveStarted190){
      gauntletWaveStarted190=now;
      gauntletWaveProg190=Math.min(info.total-4,prog+15);
    }

    const passed=prog>gauntletWaveProg190+7;
    const timedOut=now-gauntletWaveStarted190>3200;
    if(passed||timedOut){
      const w=gauntletAnalytics191.wave[gauntletWaveIndex190];
      if(w){w.attempts++;if(passed)w.passed++;}
      gauntletStats190.wavesPassed++;
      gauntletWaveIndex190=(gauntletWaveIndex190+1)%GAUNTLET_WAVES_190.length;
      gauntletWaveStarted190=now;
      gauntletWaveProg190=Math.min(info.total-4,prog+14);
    }

    const wave=gauntletWaveIndex190;
    const t=Math.max(0,(now-gauntletWaveStarted190)/1000);
    const width=Math.max(1.7,roadHalf120(lead,info,gauntletWaveProg190));
    let defs=[];

    if(wave===0){
      defs=[
        {dp:0,lane:0,stop:false}
      ];
    }else if(wave===1){
      defs=[
        {dp:-1.2,lane:-width*.72+Math.min(width*1.35,t*3.2),stop:false},
        {dp: 1.4,lane: width*.72-Math.min(width*1.35,t*3.0),stop:false}
      ];
    }else if(wave===2){
      defs=[
        {dp:-1.8,lane:-width*.68,stop:false},
        {dp:-.5,lane: width*.18,stop:false},
        {dp: .8,lane:-width*.12,stop:false},
        {dp: 2.0,lane: width*.66,stop:false}
      ];
    }else if(wave===3){
      defs=[
        {dp:-.7,lane:-width*.28,stop:true},
        {dp: .8,lane: width*.30,stop:true},
        {dp: 2.1,lane:0,stop:true}
      ];
    }else if(wave===4){
      const sweep=Math.min(width*.95,t*2.8);
      defs=[
        {dp:-1.0,lane:-width*.95+sweep,stop:false},
        {dp: .6,lane: width*.95-sweep,stop:false},
        {dp: 2.1,lane:-width*.70+sweep*.75,stop:false},
        {dp: 3.4,lane: width*.70-sweep*.75,stop:false}
      ];
    }else{
      defs=[
        {dp:-2.4,lane:-width*.60,stop:false},
        {dp:-1.2,lane: width*.40,stop:false},
        {dp:0,lane:-width*.20,stop:false},
        {dp:1.1,lane: width*.62,stop:false},
        {dp:2.2,lane:-width*.68,stop:false},
        {dp:3.3,lane: width*.12,stop:false}
      ];
    }

    for(let i=0;i<observers.length;i++){
      const o=observers[i];
      if(i<defs.length){
        const d=defs[i];
        gauntletConfigureObserver190(
          o,info,gauntletWaveProg190+d.dp,d.lane,now,dt,d.stop
        );
      }else{
        // Park unused test observers far behind the current wave.
        gauntletConfigureObserver190(
          o,info,Math.max(0,prog-25-i),((i%2)?1:-1)*width*.8,now,dt,true
        );
        o._gauntletActive190=false;
      }
    }
  }

  function renderGauntletHud190(now=gameNow()){
    if(!gauntletMode190)return;
    if(now-gauntletLastHud190<80)return;
    gauntletLastHud190=now;

    const hud=document.getElementById("gauntletHud190");
    const wave=document.getElementById("gauntletWave190");
    const stats=document.getElementById("gauntletStats190");
    const death=document.getElementById("gauntletDeath190");
    if(!hud)return;

    hud.classList.remove("hidden");
    if(wave)wave.textContent=`${gauntletWaveIndex190+1}/6 · ${GAUNTLET_WAVES_190[gauntletWaveIndex190]}`;

    const alive=players.filter(p=>!p.dead&&!p.done).length;
    if(stats)stats.textContent=
      `시도 ${gauntletStats190.attempts} · 생존 ${gauntletStats190.clears} · 사망 ${gauntletStats190.deaths}\n`+
      `통과 웨이브 ${gauntletStats190.wavesPassed} · 현재 생존 ${alive}/${players.length}`;

    const d=gauntletStats190.lastDeath;
    if(death){
      death.textContent=d
        ? `LAST DEATH\n${d.name} · ${d.action}\n예측 최소거리 ${d.predMin} / 실제거리 ${d.actual}\nlane ${d.lane} · progress ${d.progress}%`
        : "LAST DEATH · 없음";
    }
  }

  function setGauntletMode190(on){
    gauntletMode190=!!on;
    gauntletWaveIndex190=0;
    gauntletWaveStarted190=0;
    gauntletWaveProg190=0;

    const b=document.getElementById("gauntletBtn190");
    const hud=document.getElementById("gauntletHud190");
    if(b){
      b.classList.toggle("active",gauntletMode190);
      b.textContent=gauntletMode190?"🧪 생존 테스트 ON":"🧪 생존 테스트";
    }
    if(hud)hud.classList.toggle("hidden",!gauntletMode190);

    if(gauntletMode190){
      gauntletStats190.attempts++;gauntletAnalytics191.attemptStartedAt=gameNow();
      running=false;
      resetRound();
      if(typeof hideLeagueBoard100==="function")hideLeagueBoard100();
      start();
    }else{
      running=false;
      reset();
      if(typeof showLeagueBoard100==="function")showLeagueBoard100();
    }
  }

function spawnObservers(){
    if(gauntletMode190)return spawnGauntletObservers190();
    const arr=[];
    const avgPlayerSpeed=9.72;
    const baseSpeed=avgPlayerSpeed*OBS_SPEED_RATIO;
    observerDensityZones=makeObserverDensityZones();
    const target=observerCountForMap791();
    for(let i=0;i<target;i++){
      let spawn=null;
      for(let tries=0;tries<80;tries++){
        const cand=densitySpawnPoint();
        if(inStartObserverExclusion816(cand.x,cand.y))continue;
        spawn=cand;break;
      }
      // Extremely narrow fallback: do not force an observer into the protected launch corridor.
      if(!spawn)continue;
      const o={
        id:arr.length,
        x:spawn.x,y:spawn.y,
        vx:0,vy:0,
        speed:baseSpeed*(0.98+Math.random()*0.04),
        phase:"move",phaseUntil:0,
        cycleOffset:Math.random()*(OBS_MOVE_MS+OBS_STOP_MS),
        pattern712:["free","sweep","diagonal","cross"][arr.length%4]
      };
      pickObserverLeg712(o);
      arr.push(o);
    }
    return arr;
  }


  function resetRound(){
    cancelAnimationFrame(raf);
    replayFrames=[]; replayLastCapture=0; highlightMarkers=[];
    broadcastStoryKey="";broadcastStoryUntil=0;broadcastTickerUntil=0;broadcastTickerText="";
    broadcastLastRankSnapshot=new Map();
    players=makePlayers();
    players.forEach(p=>{
      forceStartCenter625(p);
      p._v120Prog=0;p._v120Total=NaN;
      p._lane120=0;p._laneVel120=0;
      p._headingUx121=NaN;p._headingUy121=NaN;p._maxLane121=NaN;
      p._laneVelSec181=0;
      p._avoidPlan120=null;p._avoidPlanUntil120=0;
      p._survivalHoldUntil120=0;p._variant120=null;p._variantUntil120=0;
      p._freePlan130=null;p._freePlanUntil130=0;
      p._controlMove130=null;p._controlMoveUntil130=0;p._nextControlCheck130=0;
      p._simpleEscapeUntil133=0;p._simpleEscapeLane133=NaN;
      p._masterHoldUntil140=0;p._masterLane140=NaN;p._masterStopUntil140=0;
      p._crowdPlan150=null;p._crowdPlanUntil150=0;p._crowdPlanStarted150=0;p._crowdWaitUntil150=0;
      p._vetoLane153=NaN;p._vetoUntil153=0;
      p._breakoutLane156=NaN;p._breakoutUntil156=0;
      p._singleEscapeLane160=NaN;p._singleEscapeUntil160=0;
      p._corridorLane161=NaN;p._corridorUntil161=0;
      p._threatBurstUntil163=0;p._threatZigSide163=0;p._threatZigAt163=0;
      p._actualEscapeLane170=NaN;p._actualEscapeUntil170=0;
      p._unifiedLane172=NaN;p._unifiedUntil172=0;
      p._emergencyLane193=NaN;p._emergencyUntil193=0;
      p._safeCorridorLane195=NaN;p._safeCorridorUntil195=0;p._safeCorridorSwitches195=0;
      p._executionPlan1101=null;p._executionReplans1101=0;p._executionCompleted1101=0;
      p._executionPartialReplans1103=0;
      p._executionFailed1104=0;p._executionJustFinished1104=0;
      p._executionStageTimeouts1105=0;p._lastExecutionPlanId1105=0;p._lastExecutionCreatedAt1105=0;p._lastExecutionPhase1105=0;p._lastExecutionTerminal1105="";
      p._emergencyDetectedAt1105=0;p._emergencyRequestedAt1105=0;p._emergencyEnteredAt1105=0;p._emergencyAppliedAt1105=0;
      p._microDodge1107=null;p._microDodges1107=0;p._microDodgeResumes1107=0;
      p._executionInvalidSudden1108=0;p._executionInvalidSideFlip1108=0;p._executionInvalidCrowd1108=0;p._executionTimedOut1108=0;
      p._stallRescues1110=0;
      p._denseExecutionStarts1111=0;p._denseEmergencyOverrides1111=0;
      p._executionOverlayBridge1113=null;p._executionOverlayBridges1113=0;p._executionOverlayResumes1113=0;
      p._lastExecutionOverlayId1115=0;
      p._verifiedEscapeStart1101=0;p._verifiedEscapeDeadline1101=0;p._verifiedEscapePending1101=false;
      p._aiState1102=AI_STATE_1102.NORMAL;p._aiStateSince1102=0;p._aiStateChanges1102=0;
      p._emergencyAction1102=null;p._emergencyActionUntil1102=0;
      p._specialControl197=null;p._specialControlUntil197=0;p._lastSpecialControl197=null;p._lastSpecialCountAt197=0;
      p._visualSpin197=0;p._reverseControl197=false;
    });
    observers=spawnObservers();
    unifiedCameraLeader121=-1;unifiedCameraHoldUntil121=0;
    camVelX121=0;camVelY121=0;
    running=false;
    raceStart=0; lastTs=0; lastRankingRender=0; simClock=0; simAccumulator=0; simTickCounter=0;
    lastLeaderName=""; raceEventText=""; raceEventUntil=0; bestSector=[null,null,null];liveEventFeed814=[];liveFocus814={playerId:-1,type:"",text:"",until:0};
    broadcastFocusId=-1; broadcastFocusUntil=0; previousUiRanks=new Map();
    cameraLeaderId=-1; cameraLeaderHoldUntil=0;
    raceFrameCache668={stamp:-1,active:[],leader:null,top:[]};
    telemetry696={raceStart:0,lastRanks:new Map(),leaderId:-1,leaderSince:0,leaderChanges:0};
    players.forEach(p=>{p._personality657=null;p._ability645=null;p._driverSkill739=null;p._personality754=null;p._integrated759=null;p._normalEntryAt759=0;p._reaction646=null;p._stab648=null;p._overtake642Until=0;p._overtake642TargetId=-1;p._pass485=null;p.telemetry696=null;p._stable698=null;p._lastRaceTargetKind699="";p.lastAvoidance519=0;p.avoidance519Until=0;p.hardRouteLockUntil=0;p.routeBreakCombatUntil=0;p.lockedEscapeOffset=undefined;p._actualShortestProgress719=0;p._actualShortestDeviation719=0;p._splineProg720=0;p._splineFloor754=0;p._topOffsetSign754=NaN;p._teleportGuardTrips754=0;p._splineRepair770=0;
      p._lapCheckpoint775=false;p._lapArmed775=false;p._lapComplete775=false;p._lapMaxFraction775=0;
      p._raceState720=null;p._raceMode720="NORMAL";p._lineOffset720=0;p._speedMul720=1;p._backconImpulseUntil722=0;p._nextThreatScan724=0;p._cachedThreat724=null;p._backOriginX732=undefined;p._backOriginY732=undefined;sanitizeRaceState666(p);});
    diagFrames=0; diagFps=0; diagLastFpsTs=0; diagFrameMs=0; diagMaxFrameMs=0;
    fpsProtectLevel=0; fpsLowSince=0; fpsGoodSince=0; raceLeaderChanges=0; raceTotalOvertakes=0; lastCloseBattleKey=""; lastCloseBattleEventAt=0;
    seasonRecorded=false; prevRanks=new Map();
    {
      const sp770=mapStart770();
      camX=currentMap770().id==='triple_diamond'
        ? (Number(currentMap770().destinyCameraCenterX8172)||89.0)
        : sp770.x;
      camY=sp770.y;
    }
    prevCamX730=camX; prevCamY730=camY;
    renderAlpha730=1;
    players.forEach(p=>{p.simPrevX=p.x;p.simPrevY=p.y;p._renderLastX730=p.x;p._renderLastY730=p.y;p._dgRenderX182=p.x;p._dgRenderY182=p.y;p._actualLane113=0;p._latVel114=0;p._stableSeg116=Number.isInteger(p.seg)?p.seg:0;});
    observers.forEach(o=>{o.simPrevX=o.x;o.simPrevY=o.y;});
    roundTransitioning=false;
    startBtn.textContent=`${currentRound}R 시작`;
    render(0);
    renderRanking();
    renderTeamScore();
    renderRecordBoard();
  }

  function reset(){
    replayFrames=[]; replayLastCapture=0; replayPlaying=false; replayCursor=0;
    replaySpeed=1; replayLastTs=0; replayFocusId=-1;
    replayArchive={}; highlightArchive={}; photoFinishArchive={}; replaySelectedRound=1;

    createTeams();
    initTournament();
    resetRound();
  }
  function currentProgress(p){
    if(p.done) return routeLength+1000-(p.finishTime||0)/1000000;
    if(Number.isFinite(p?._v120Prog) && Number.isFinite(p?._v120Total) && p._v120Total>0){
      return Math.max(0,Math.min(1,p._v120Prog/p._v120Total))*routeLength;
    }
    if(currentMap770().id==='triple_diamond'){
      destinyPath813(p);
      const total=Math.max(1,p._dgSegs813?.total||1);
      const prog=Math.max(0,Math.min(total,Number(p._dgProg813)||0));
      return (prog/total)*routeLength;
    }
    const s=segs[Math.min(p.seg,segs.length-1)];
    const along=((p.x-s.a[0])*s.ux+(p.y-s.a[1])*s.uy);
    return s.start + Math.max(0,Math.min(s.L,along));
  }



  function togglePause(){
    if(!running || !raceStart) return;
    if(!paused){
      paused=true;
      pauseStarted=performance.now();
      cancelAnimationFrame(raf);
      if(pauseBtn){pauseBtn.textContent="▶ 계속";pauseBtn.classList.add("paused");}
      render(pauseStarted);
      return;
    }
    const now=performance.now();
    paused=false;
    // v3.33: simClock is the authoritative race clock. It does not advance while
    // paused, so gameplay timers must NOT be shifted by real-world pause duration.
    pauseStarted=0;
    lastTs=now;
    simAccumulator=0;
    if(pauseBtn){pauseBtn.textContent="⏸ 일시정지";pauseBtn.classList.remove("paused");}
    raf=drawDebugHud519(ctx);
    requestAnimationFrame(loop);
  }

  function start(){
    if(running) return;
    paused=false;
    if(pauseBtn){pauseBtn.textContent="⏸ 일시정지";pauseBtn.classList.remove("paused");}
    if(players.every(p=>p.done)) return;
    running=true;
    const now=performance.now();
    if(!raceStart){
      players.forEach(forceStartCenter625);
      raceStart=now;
      for(const p of players){
        p._startProtectionUntil816=now+1000;
        p._startAiBoostUntil816=now+3000;
        p._nextThreatScan724=0;
        p._cachedThreat724=null;
      }
      // v2.43: LIVE commentary UI removed.
      // v2.14: each racer gets a small stat-driven launch quality.
      // This is a start skill effect, not comeback rubber-banding.
      for(let i=0;i<players.length;i++){
        const p=players[i];
        const sk739=driverSkill739(p);
        const start=sk739.start,reaction=sk739.reaction,accel=sk739.acceleration;
        const focus=sk739.focus,pressure=sk739.pressure,consistency=sk739.consistency;
        const skill=sk739.startSkill;

        // v2.7 explicit start reaction: 0.045–0.220 s.
        const reactionNoise=(Math.random()-.5)*(34*(1-consistency)+5);
        p.startReactionMs=Math.max(52,Math.min(235,
          228-skill*155+reactionNoise));
        p.startExecution=Math.max(.970,Math.min(1.035,
          .982+skill*.045+(p.raceForm-1)*.05+(Math.random()-.5)*(.010*(1-consistency))));

        // Opening lane is derived from the persistent route signature + driving personality.
        // No spawn offset is used: everyone physically starts at the current yellow-box center x=31.05,y=132.55.
        const half0=Math.max(2.0,widths[0]*.66);
        const id=identityOf(p);
        const styleBias=(id.apex-1)*.34+(id.pass-1)*.20-(id.safety-1)*.18;
        const signature=(p.openingLineBias||0)*.78+(p.routeBand||0)*.22+styleBias;
        const controlN=p.stats.control/100;
        // v4.62 OPENING FAST-LINE: the start fan is no longer allowed to waste the
        // long first approach on the slow/outside half. Read the first real corner
        // from route geometry and place every racer in a small skill/personality band
        // around that corner's fastest inside approach. Diversity remains, but it is
        // diversity around a good racing line rather than random upper/lower spreading.
        const openingSide=Math.sign(openingInsideBias(0))||1;
        const openingSkill=(p.stats.routeReading+p.stats.insideLine+p.stats.cornering)/300;
        const microBand=Math.max(-.16,Math.min(.16,signature*.10+(p.index%3-1)*.018));
        const fastStartBase=.72+openingSkill*.14+start*.05+microBand;
        const fastStartNorm=currentMap770().openingInsideLock795
          ? Math.max(.74,Math.min(.94,fastStartBase+.035))
          : Math.max(.64,Math.min(.94,fastStartBase));
        p.startLineTarget=openingSide*half0*fastStartNorm;
        p.startLineCommit=Math.max(.76,Math.min(1,.80+start*.08+reaction*.06+controlN*.05));
        p.startDecisionUntil=now+2050+start*330+reaction*170;
        p.startBurstPhase=Math.max(0,Math.min(1,skill));

        const jitter=(Math.random()-.5)*(.012*(1-consistency));
        p.startLaunchMul=Math.max(.965,Math.min(1.055,.982+skill*.050+jitter+(p.raceForm-1)*.05));
        p.startLaunchUntil=now+1850+accel*330+start*220;
      }
    }
    lastTs=now;
    simClock=now; simAccumulator=0;
    try{
      rebuildObserverGrid();
      precomputeObserverPredictions(now);
      startBtn.textContent="진행 중";
      raf=requestAnimationFrame(loop);
    }catch(err){
      running=false;
      startBtn.textContent=`${currentRound}R 시작`;
      console.error("[Observer Avoid FM] start failed",err);
      throw err;
    }
  }

  function beginControl(p,mode,now,duration,reactive,threatId=-1,backconStyleHint=null){
    p.controlMode=mode;
    p.reactiveControl=reactive;
    p.reactiveThreatId=threatId;
    p.modeStart=now;
    p.controlUntil=now+duration;
    // v2.61: two visible back-control techniques.
    // LONG = meaningful reverse then forward burst; TAP = tiny reverse tap then instant forward.
    if(mode==="backcon"){
      p.backconStyle=(backconStyleHint==="long"||backconStyleHint==="tap")
        ? backconStyleHint
        : (Math.random()<.52?"long":"tap");
      if(p.backconStyle==="long") p.controlUntil=now+Math.max(duration,420+Math.random()*170);
      else p.controlUntil=now+Math.min(duration,220+Math.random()*90);
    }else{
      p.backconStyle="none";
    }

    const control=(p.stats.control-72)/27;
    const reaction=(p.stats.reaction-72)/27;
    const stability=(p.stats.stability-72)/27;
    const focus=(p.stats.focus-72)/27;
    const pressure=(p.stats.pressure-72)/27;

    // Failure means imperfect execution/time loss, never an intentional collision.
    let base=.78 + control*.075 + reaction*.055 + stability*.045 + focus*.025;
    if(reactive) base-=.035; // emergency controls are harder to execute cleanly
    if(mode==="backcon") base-=.045;
    else if(mode==="zigzag") base-=.018;
    else if(mode==="stopcon") base+=.045;
    base+=pressure*.018;
    base+=(p.raceForm-1)*.42;
    const successChance=Math.max(.65,Math.min(.97,base));
    p.controlSuccess=Math.random()<successChance;
    p.controlQuality=p.controlSuccess
      ? (.91+Math.random()*.09)
      : (.58+Math.random()*.20);
    p.controlMistakeSide=Math.random()<.5?-1:1;
    if(!p.controlSuccess && mode==="stopcon"){
      p.controlUntil+=85+Math.random()*70;
    }

    if(reactive && p.controlSuccess && (mode==="backcon" || mode==="stopcon")){
      addAutoHighlight(mode==="backcon"?"BACKCON":"STOPCON",
        `${p.name} · ${mode==="backcon"?"빽컨 회피":"스탑컨 세이브"}`,now,p.index,1);
    }

    if(p.match){
      p.match.controlAttempts=(p.match.controlAttempts||0)+1;
      if(p.controlSuccess) p.match.controlSuccesses=(p.match.controlSuccesses||0)+1;
      const c=p.match.controlByType&&p.match.controlByType[mode];
      if(c){
        c.attempts++;
        if(p.controlSuccess) c.successes++;
      }
    }
  }



  function clampRoadOffset(si,lateral,p=null){
    // v4.10: normal AI stays on the route ribbon. During an explicit extreme-inside
    // attempt, air units may use the full survivable margin; failed attempts are allowed
    // to target just beyond it and are then killed by lethalOutsideRoad().
    let legalHalf=Math.max(2.0,widths[si]*ROAD_MARGIN);
    if(p && p.extremeInsideActive){
      legalHalf += DEATH_EDGE_EXTRA + (p.extremeInsideFail?1.25:-0.42);
    }
    return Math.max(-legalHalf*.998,Math.min(legalHalf*.998,lateral));
  }

  // v4.09 COURSE MODEL:
  // The route itself is the source of truth. We do NOT encode the user's red markup
  // as coordinate rectangles. Every route segment is treated as a rounded corridor
  // (capsule), so bends join naturally, all normal/inside lines are drivable, and the
  // large gaps between unrelated roads remain lethal. Yellow zones use safeAt().
  
  // v4.96 HARD RESTRICTED AREAS
  // These seven rectangles are the exact red boxes marked by the user on the full-map
  // screenshot, transformed into game coordinates. They are absolute no-entry zones.
  const S_MAP_FORBIDDEN_770=[
    {x1:0.00,y1:0.80,x2:86.99,y2:11.72},
    {x1:0.18,y1:11.46,x2:10.22,y2:78.34},
    {x1:55.78,y1:35.17,x2:88.78,y2:45.83},
    {x1:76.94,y1:58.62,x2:88.60,y2:75.14},
    {x1:33.00,y1:109.25,x2:112.10,y2:121.78},
    {x1:148.86,y1:56.49,x2:165.36,y2:157.22},
    {x1:61.34,y1:156.95,x2:165.36,y2:170.54}
  ];
  const FORBIDDEN96_PAD=.18;
  function currentForbidden770(){return currentMap770().forbiddenZones770||[];}
  function inForbidden96(x,y,pad=FORBIDDEN96_PAD){
    for(const z of currentForbidden770()){
      if(x>=z.x1-pad && x<=z.x2+pad && y>=z.y1-pad && y<=z.y2+pad)return true;
    }
    return false;
  }


  function lineHitsForbidden96(x1,y1,x2,y2,pad=FORBIDDEN96_PAD){
    const dist=Math.hypot(x2-x1,y2-y1);
    const n=Math.max(2,Math.ceil(dist/.28));
    for(let k=0;k<=n;k++){
      const t=k/n;
      if(inForbidden96(x1+(x2-x1)*t,y1+(y2-y1)*t,pad)) return true;
    }
    return false;
  }

function courseContainsPoint(x,y,extra=0){
    if(safeAt(x,y)) return true;
    const m=currentMap770();
    if(m.id!=="s_map")return genericCourseMask771(m,x,y,extra);
    // Preserve the battle-tested S-map physical envelope exactly.
    for(let i=0;i<segs.length;i++){
      const s=segs[i], rx=x-s.a[0], ry=y-s.a[1];
      const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
      const qx=s.a[0]+s.ux*along, qy=s.a[1]+s.uy*along;
      const r=Math.max(2.0,widths[i]*ROAD_MARGIN)+extra;
      const dx=x-qx,dy=y-qy;
      if(dx*dx+dy*dy<=r*r) return true;
    }
    return false;
  }

  function lineStaysOnCourse(x1,y1,x2,y2,extra=ROUTE_PLAN_EXTRA){
    // v4.96: no target/path chord may cross a red restricted area.
    if(lineHitsForbidden96(x1,y1,x2,y2)) return false;
    const dist=Math.hypot(x2-x1,y2-y1);
    const n=Math.max(2,Math.ceil(dist/.70));
    for(let k=1;k<=n;k++){
      const t=k/n;
      if(!courseContainsPoint(x1+(x2-x1)*t,y1+(y2-y1)*t,extra)) return false;
    }
    return true;
  }



  function segmentRangeContains69(x,y,lo,hi,extra){
    lo=Math.max(0,lo); hi=Math.min(segs.length-1,hi);
    for(let i=lo;i<=hi;i++){
      const s=segs[i],rx=x-s.a[0],ry=y-s.a[1];
      const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
      const qx=s.a[0]+s.ux*along,qy=s.a[1]+s.uy*along;
      const r=Math.max(2.0,widths[i]*ROAD_MARGIN)+extra;
      const dx=x-qx,dy=y-qy;
      if(dx*dx+dy*dy<=r*r) return true;
    }
    return false;
  }

  function lethalOutsideRoad(p,now){
    // v7.87 GLOBAL AIR-UNIT EDGE RULE:
    // Road rails/outer edge lines are visual guidance, NOT physical walls.
    // NORMAL, EVADE and REJOIN may cross them without death, bounce, rollback or freeze.
    // Planning still prefers the road, and explicit hardForbidden780 obstacles remain physical.
    if(currentMap770().edgePassThrough786){
      p.outsideGrace69Since=0;
      return false;
    }

    // v7.85 edge hysteresis: a racer following the authoritative optimal spline may
    // visually skim the last legal road line. Small floating-point / capsule-boundary
    // disagreements must not alternate legal/illegal every frame. Accept a narrow
    // soft envelope only while NORMAL on the two patched maps; this never opens a
    // shortcut because actual position still advances on the prevalidated spline.
    const m785=currentMap770();
    if(m785.edgeFlow785 && p?._raceState720?.mode==="NORMAL" &&
       courseContainsPoint(p.x,p.y,.38)) {
      const pr785=Math.max(0,Math.min(RACING_SPLINE_SEGS_720.total||0,Number(p._splineProg720)||0));
      const rq785=splinePointAt720(pr785);
      if(rq785 && Math.hypot(p.x-rq785.x,p.y-rq785.y)<=.72){
        p.outsideGrace69Since=0;
        return false;
      }
    }

    // v7.84 targeted anti-stall guard. If numerical steering ever places a calm
    // racer outside while its authoritative spline point is still legal, recover
    // to that same-progress spline point instead of killing/freezing the unit.
    const m784=currentMap770();
    if(m784.stallProofSpline784 && p?._raceState720?.mode==="NORMAL" &&
       !courseContainsPoint(p.x,p.y,DEATH_EDGE_EXTRA)){
      const pr=Math.max(0,Math.min(RACING_SPLINE_SEGS_720.total||0,Number(p._splineProg720)||0));
      const rq=splinePointAt720(pr);
      if(rq && courseContainsPoint(rq.x,rq.y,0) && visualRoadMask674(rq.x,rq.y,0) &&
         !(m784.hardForbidden780&&inForbidden96(rq.x,rq.y,0))){
        p.x=rq.x;p.y=rq.y;p.mouseTargetX=rq.x;p.mouseTargetY=rq.y;
        p._stallProofRecoveries784=(p._stallProofRecoveries784||0)+1;
        p.outsideGrace69Since=0;
        return false;
      }
    }

    // Standard whole-map lethal corridor.
    if(courseContainsPoint(p.x,p.y,DEATH_EDGE_EXTRA)){
      p.outsideGrace69Since=0;
      return false;
    }

    // v4.69 11-O'CLOCK CORNER GRACE:
    // The climb from 9 o'clock through the upper-left kink (route segments ~20-26)
    // used to kill borderline legal-looking inside cuts because the rounded segment
    // capsules met too tightly. Give that LOCAL transition a small geometric cushion.
    // This does not open a global shortcut and does not change driving physics.
    const inUpperLeft=currentMap770().id==="s_map"&&p.seg>=19&&p.seg<=27;
    if(inUpperLeft && segmentRangeContains69(p.x,p.y,20,26,DEATH_EDGE_EXTRA+2.05)){
      p.outsideGrace69Since=0;
      return false;
    }

    // One-frame / tiny steering overshoots near that same corner get a short grace.
    // A genuinely early cut remains outside the soft envelope and dies immediately;
    // lingering outside also dies after the brief tolerance expires.
    if(inUpperLeft && segmentRangeContains69(p.x,p.y,20,26,DEATH_EDGE_EXTRA+3.05)){
      if(!p.outsideGrace69Since) p.outsideGrace69Since=now||1;
      if((now||0)-p.outsideGrace69Since<=170) return false;
    }else{
      p.outsideGrace69Since=0;
    }
    return true;
  }





  const OBS_GRID_SIZE = 16;
  let OBS_GRID_COLS = Math.ceil(MAP_W/OBS_GRID_SIZE);
  let OBS_GRID_ROWS = Math.ceil(MAP_H/OBS_GRID_SIZE);
  let observerGrid = Array.from({length:OBS_GRID_COLS*OBS_GRID_ROWS},()=>[]);
  function resizeObserverGrid777(){
    OBS_GRID_COLS=Math.max(1,Math.ceil(MAP_W/OBS_GRID_SIZE));
    OBS_GRID_ROWS=Math.max(1,Math.ceil(MAP_H/OBS_GRID_SIZE));
    observerGrid=Array.from({length:OBS_GRID_COLS*OBS_GRID_ROWS},()=>[]);
  }

  function rebuildObserverGrid(){
    for(let i=0;i<observerGrid.length;i++) observerGrid[i].length=0;
    for(let i=0;i<observers.length;i++){
      const o=observers[i];
      let gx=Math.floor(o.x/OBS_GRID_SIZE);
      let gy=Math.floor(o.y/OBS_GRID_SIZE);
      if(gx<0) gx=0; else if(gx>=OBS_GRID_COLS) gx=OBS_GRID_COLS-1;
      if(gy<0) gy=0; else if(gy>=OBS_GRID_ROWS) gy=OBS_GRID_ROWS-1;
      observerGrid[gy*OBS_GRID_COLS+gx].push(o);
    }
  }

  const nearbyBufferPool = Array.from({length:12},()=>[]);
  const localPlayerBuffers = Array.from({length:12},()=>[]);
  const threatObserverBuffers = Array.from({length:12},()=>[]);
  const threatDistanceBuffers = Array.from({length:12},()=>[]);

  let nearbyBufferIndex=0;

  function nearbyObservers(x,y,r){
    const out=nearbyBufferPool[nearbyBufferIndex];
    nearbyBufferIndex=(nearbyBufferIndex+1)%nearbyBufferPool.length;
    out.length=0;
    const minX=Math.floor((x-r)/OBS_GRID_SIZE);
    const maxX=Math.floor((x+r)/OBS_GRID_SIZE);
    const minY=Math.floor((y-r)/OBS_GRID_SIZE);
    const maxY=Math.floor((y+r)/OBS_GRID_SIZE);
    for(let gx=minX;gx<=maxX;gx++){
      for(let gy=minY;gy<=maxY;gy++){
        if(gx<0||gy<0||gx>=OBS_GRID_COLS||gy>=OBS_GRID_ROWS) continue;
        const bucket=observerGrid[gy*OBS_GRID_COLS+gx];
        for(let i=0;i<bucket.length;i++) out.push(bucket[i]);
      }
    }
    return out;
  }

  // v4.23 HUMAN REACTION TIMING
  // Returns a small, player-specific delay instead of letting the AI react on the same frame.
  // Reaction/focus/pressure reduce delay; consistency reduces timing variance.
  function humanRecognitionDelayMs(p,urgency=0){
    const reactionN=Math.max(0,Math.min(1,(p.stats.reaction-72)/27));
    const focusN=Math.max(0,Math.min(1,(p.stats.focus-72)/27));
    const pressureN=Math.max(0,Math.min(1,(p.stats.pressure-72)/27));
    const consistencyN=Math.max(0,Math.min(1,(p.stats.consistency-72)/27));
    const skill=reactionN*.55+focusN*.30+pressureN*.15;
    const base=156-skill*78-urgency*26;
    const spread=38-consistencyN*25;
    return Math.max(50,Math.min(184,base+(Math.random()-.5)*spread));
  }



  // v4.21 HUMAN PERCEPTION LAYER
  // AI planning is no longer allowed to consume the omniscient nearby-observer list.
  // A racer sees a forward cone plus a small close peripheral bubble, then keeps a
  // short imperfect memory. Physical collision still checks the real observer field.
  function playerPerceivedObservers(p,r,now=performance.now()){
    if(!p.perceivedObservers || !(p.perceivedObservers instanceof Map)) p.perceivedObservers=new Map();
    const reactionN=Math.max(0,Math.min(1,(p.stats.reaction-72)/27));
    const focusN=Math.max(0,Math.min(1,(p.stats.focus-72)/27));
    const predictionN=Math.max(0,Math.min(1,(p.stats.prediction-72)/27));
    const consistencyN=Math.max(0,Math.min(1,(p.stats.consistency-72)/27));
    const perceptionSkill=focusN*.42+reactionN*.25+predictionN*.25+consistencyN*.08;
    // v4.59.6 DYNAMIC VISION: racers look much farther down the road than sideways.
    // The larger forward read is still personal/stat-driven and uses perceived motion only.
    const visionScale=.98+focusN*.12+reactionN*.06;
    const maxR=Math.min(r,(p.visionRadius||r)*visionScale);
    const raw=playerNearbyObservers(p,maxR);
    let hx=p.steerX||0, hy=p.steerY||0;
    let hl=Math.hypot(hx,hy);
    if(hl<.15){ const seg=segs[Math.min(p.seg,segs.length-1)]; hx=seg.ux; hy=seg.uy; hl=1; }
    hx/=hl; hy/=hl;
    const halfFov=(78+focusN*10)*Math.PI/180; // v4.59.7 very wide forward combat vision // v4.59.6 wider forward awareness
    const cosFov=Math.cos(halfFov);
    const peripheral=4.20+reactionN*1.60;
    const memoryMs=350+predictionN*430+focusN*220;
    for(const o of raw){
      const dx=o.x-p.x,dy=o.y-p.y,d=Math.hypot(dx,dy);
      if(d<.001) continue;
      const dot=(dx*hx+dy*hy)/d;
      const visible=d<=peripheral || dot>=cosFov;
      if(visible){
        const prev=p.perceivedObservers.get(o.id);
        // v4.37: marginal/far sightings may need a second visual sample for lower-focus
        // racers. Close peripheral threats are never randomly hidden.
        const edgeN=Math.max(0,Math.min(1,(dot-cosFov)/Math.max(.001,1-cosFov)));
        const farN=Math.max(0,Math.min(1,d/Math.max(1,maxR)));
        const weakSight=d>peripheral+1.5 && (farN>.56 || edgeN<.24);
        const confirmNeed=weakSight ? (1+(perceptionSkill<.52?2:perceptionSkill<.76?1:0)) : 1;
        const seenCount=(prev?.seenCount||0)+1;
        // Never drop an already-confirmed track; uncertainty is in acquisition/estimate.
        if(!prev?.confirmed && seenCount<confirmNeed){
          p.perceivedObservers.set(o.id,{id:o.id,lastSeen:now,x:o.x,y:o.y,vx:0,vy:0,visible:true,
            awareAt:now+humanRecognitionDelayMs(p,0),seenCount,confirmed:false,errX:0,errY:0});
          continue;
        }
        let evx=0,evy=0;
        if(prev && now>prev.lastSeen+18){
          const dt=(now-prev.lastSeen)/1000;
          const rawVx=(o.x-prev.x)/dt, rawVy=(o.y-prev.y)/dt;
          const smooth=.54+predictionN*.29;
          evx=(prev.vx||0)*(1-smooth)+rawVx*smooth;
          evy=(prev.vy||0)*(1-smooth)+rawVy*smooth;
        }else if(prev){ evx=prev.vx||0; evy=prev.vy||0; }
        // Smooth, bounded visual estimate error. It shrinks as the observer gets closer
        // and as Focus/Prediction improve; no per-frame jitter and no fake collision.
        const errAmp=(.39-perceptionSkill*.31)*Math.max(.16,Math.min(1,d/18));
        const phase=(o.id*1.731+(p.perceptionTrackSeed||0));
        const targetErrX=(p.perceptionBiasX||0)*(.35+farN*.65)+Math.sin(phase)*errAmp;
        const targetErrY=(p.perceptionBiasY||0)*(.35+farN*.65)+Math.cos(phase*1.17)*errAmp;
        const errX=(prev?.errX||0)*.72+targetErrX*.28;
        const errY=(prev?.errY||0)*.72+targetErrY*.28;
        const urgency=Math.max(0,Math.min(1,(peripheral+2.8-d)/(peripheral+2.8)));
        const awareAt=prev?.confirmed ? (prev.awareAt||now) : (now+humanRecognitionDelayMs(p,urgency));
        p.perceivedObservers.set(o.id,{id:o.id,lastSeen:now,x:o.x,y:o.y,vx:evx,vy:evy,visible:true,
          awareAt,seenCount,confirmed:true,errX,errY});
      }
    }
    const out=[];
    for(const [id,m] of p.perceivedObservers){
      const age=now-m.lastSeen;
      if(age>memoryMs){ p.perceivedObservers.delete(id); continue; }
      if(!m.confirmed || now<(m.awareAt||0)) continue;
      if(m.awareAt){ p.lastRecognitionDelayMs=Math.max(0,m.awareAt-(m.lastSeen-age)); }
      const ageSec=age/1000;
      const fade=Math.max(0,1-age/memoryMs);
      const px=m.x+(m.errX||0)*fade+(m.vx||0)*ageSec*fade;
      const py=m.y+(m.errY||0)*fade+(m.vy||0)*ageSec*fade;
      const dx=px-p.x,dy=py-p.y;
      if(dx*dx+dy*dy<=r*r) out.push({
        id:m.id,x:px,y:py,vx:(m.vx||0)*fade,vy:(m.vy||0)*fade,
        phase:'move',phaseUntil:now+Math.max(120,memoryMs-age),speed:Math.hypot(m.vx||0,m.vy||0),
        perceived:true,confidence:fade*(.82+perceptionSkill*.18),lastSeenAge:age
      });
    }
    p.perceptionLastUpdate=now;
    return out;
  }

  // v2.7 performance: clustered racers share one broad observer-grid lookup.
  let playerNearbyFrameSerial=0;
  const playerNearbyFrameCache=Array.from({length:12},()=>({frame:-1,cellKey:"",broad:[],ranges:Object.create(null)}));
  let sharedNearbyFrame=-1;
  const sharedNearbyCells=new Map();

  function playerNearbyObservers(p,r){
    if(sharedNearbyFrame!==playerNearbyFrameSerial){
      sharedNearbyFrame=playerNearbyFrameSerial;
      sharedNearbyCells.clear();
    }
    const gx=Math.max(0,Math.min(OBS_GRID_COLS-1,Math.floor(p.x/OBS_GRID_SIZE)));
    const gy=Math.max(0,Math.min(OBS_GRID_ROWS-1,Math.floor(p.y/OBS_GRID_SIZE)));
    const cellKey=gx+":"+gy;
    let shared=sharedNearbyCells.get(cellKey);
    if(!shared){
      const cx=(gx+.5)*OBS_GRID_SIZE, cy=(gy+.5)*OBS_GRID_SIZE;
      const rr=AVOID_SCAN_RADIUS+OBS_GRID_SIZE*.76;
      const raw=nearbyObservers(cx,cy,rr);
      shared=[];
      for(let i=0;i<raw.length;i++) shared.push(raw[i]);
      sharedNearbyCells.set(cellKey,shared);
    }
    const cache=playerNearbyFrameCache[p.index];
    if(cache.frame!==playerNearbyFrameSerial || cache.cellKey!==cellKey){
      cache.frame=playerNearbyFrameSerial;
      cache.cellKey=cellKey;
      cache.broad.length=0;
      cache.ranges=Object.create(null);
      const broadR2=AVOID_SCAN_RADIUS*AVOID_SCAN_RADIUS;
      for(let i=0;i<shared.length;i++){
        const o=shared[i],dx=o.x-p.x,dy=o.y-p.y;
        if(dx*dx+dy*dy<=broadR2) cache.broad.push(o);
      }
    }
    if(r>=AVOID_SCAN_RADIUS-.001) return cache.broad;
    const key=String(r);
    let arr=cache.ranges[key];
    if(!arr) arr=cache.ranges[key]=[];
    arr.length=0;
    const r2=r*r;
    for(let i=0;i<cache.broad.length;i++){
      const o=cache.broad[i],dx=o.x-p.x,dy=o.y-p.y;
      if(dx*dx+dy*dy<=r2) arr.push(o);
    }
    return arr;
  }

  function escapeCorridorBias(p,s,nearby){
    // Look at several threats as one obstacle field instead of dodging only the
    // nearest observer. Positive/negative scores represent safer road sides.
    let leftRisk=0,rightRisk=0;
    const px=p.x+s.ux*p.speed*1.15;
    const py=p.y+s.uy*p.speed*1.15;
    for(let i=0;i<nearby.length;i++){
      const o=nearby[i];
      const dx=o.x-px, dy=o.y-py;
      const along=dx*s.ux+dy*s.uy;
      if(along<-3 || along>16) continue;
      const lat=dx*s.nx+dy*s.ny;
      const weight=Math.max(0,16-Math.abs(along));
      if(lat<0) leftRisk+=weight/(1+Math.abs(lat));
      else rightRisk+=weight/(1+Math.abs(lat));
    }
    return Math.max(-1,Math.min(1,(leftRisk-rightRisk)/8));
  }


  function observerClusterPlan(p,s,nearby){
    // v2.12: treat multiple nearby observers as a moving obstacle field.
    // We evaluate left / center / right corridors over several future horizons,
    // then commit briefly to the clearest escape corridor instead of reacting
    // to one observer at a time.
    const si=Math.min(p.seg,widths.length-1);
    const roadHalf=Math.max(2.2,widths[si]*0.56);
    const lateralNow=((p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny);
    const laneOffsets=[-roadHalf*.96,-roadHalf*.72,-roadHalf*.48,-roadHalf*.24,0,
      roadHalf*.24,roadHalf*.48,roadHalf*.72,roadHalf*.96];
    const laneRisk=laneOffsets.map(()=>0);
    const horizons=[.34,.72,1.18,1.82,2.65,3.35]; // v4.54: denser multi-observer future field
    let frontCount=0, closeCount=0, nearest=999;

    for(let hi=0;hi<horizons.length;hi++){
      const t=horizons[hi];
      const horizonWeight=hi===0?1.58:hi===1?1.22:hi===2?.96:hi===3?.76:.58; // v4.54
      const forward=p.speed*t;
      for(let li=0;li<laneOffsets.length;li++){
        const off=lateralNow+(laneOffsets[li]-lateralNow)*Math.min(1,t/.75);
        const px=p.x+s.ux*forward+s.nx*(off-lateralNow);
        const py=p.y+s.uy*forward+s.ny*(off-lateralNow);
        let risk=0;
        for(let oi=0;oi<nearby.length;oi++){
          const o=nearby[oi];
          const ox=predictedObserverX(o,t), oy=predictedObserverY(o,t);
          const dx=ox-px, dy=oy-py;
          const d2=dx*dx+dy*dy;
          if(d2<81){
            const d=Math.sqrt(d2);
            risk += Math.max(0,9-d)*horizonWeight*(d<3.2?4.1:d<5.2?2.0:.72);
          }
        }
        // v4.54 MULTI-OBSERVER: a lane with several medium-close observers is more
        // dangerous than one equally-close observer. Add a pinch/congestion penalty so
        // AI does not escape observer A into the overlap of B/C.
        let pinch=0, nearLane=0;
        for(let oi=0;oi<nearby.length;oi++){
          const o=nearby[oi];
          const ox=predictedObserverX(o,t), oy=predictedObserverY(o,t);
          const d=Math.hypot(ox-px,oy-py);
          if(d<6.2){ nearLane++; pinch+=Math.max(0,6.2-d); }
        }
        if(nearLane>=2) risk += pinch*(nearLane-1)*.36*horizonWeight;
        laneRisk[li]+=risk;
      }
    }

    for(let oi=0;oi<nearby.length;oi++){
      const o=nearby[oi];
      const dx=o.x-p.x, dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy;
      const lat=Math.abs(dx*s.nx+dy*s.ny);
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d<nearest) nearest=d;
      if(along>0 && along<15 && lat<roadHalf*1.35) frontCount++;
      if(along>0 && along<7.5 && lat<roadHalf*.95) closeCount++;
    }

    // v2.62: reward genuine openings between clusters, not just left/right escape.
    // This allows center gaps as well as outer corridors when 3–6 observers bunch up.
    if(frontCount>=3){
      for(let li=0;li<laneOffsets.length;li++){
        let nearestLatGap=99;
        for(let oi=0;oi<nearby.length;oi++){
          const o=nearby[oi],dx=o.x-p.x,dy=o.y-p.y;
          const along=dx*s.ux+dy*s.uy;
          if(along<=0||along>12) continue;
          const lat=dx*s.nx+dy*s.ny;
          nearestLatGap=Math.min(nearestLatGap,Math.abs(lat-laneOffsets[li]));
        }
        if(nearestLatGap>1.55) laneRisk[li]-=Math.min(10,(nearestLatGap-1.55)*2.4);
      }
    }

    let bestLane=0;
    for(let li=1;li<laneRisk.length;li++) if(laneRisk[li]<laneRisk[bestLane]) bestLane=li;
    const second=laneRisk.map((_,i)=>i).filter(i=>i!==bestLane).sort((a,b)=>laneRisk[a]-laneRisk[b])[0];
    const advantage=Math.max(0,laneRisk[second]-laneRisk[bestLane]);
    const density=Math.min(1,frontCount/5);
    const confidence=Math.min(1,advantage/12 + density*.42 + closeCount*.11);
    const preferredOffset=laneOffsets[bestLane];
    const emergency=closeCount>=2 || nearest<3.9;

    return {preferredOffset,confidence,density,emergency,frontCount,closeCount,laneRisk};
  }

  function cornerInsideSide(si){
    const i=Math.max(1,Math.min(route.length-2,si));
    const a=route[i-1], b=route[i], c=route[i+1];
    const v1x=b[0]-a[0], v1y=b[1]-a[1];
    const v2x=c[0]-b[0], v2y=c[1]-b[1];
    const cross=v1x*v2y-v1y*v2x;
    if(Math.abs(cross)<0.20) return 0;
    // Screen coordinates use +Y downward. That flips the handedness of the
    // ordinary Cartesian cross-product test. +off is still the racer's right
    // side (segment normal nx=-uy, ny=ux), so a screen-space negative cross is
    // a visual LEFT turn and its inside is -off; positive cross is a RIGHT
    // turn and its inside is +off. This generic rule fixes every corner without
    // hard-coded map coordinates.
    return cross<0 ? -1 : 1;
  }

  function cornerIntensity(si){
    const i=Math.max(1,Math.min(route.length-2,si));
    const a=route[i-1], b=route[i], c=route[i+1];
    const v1x=b[0]-a[0], v1y=b[1]-a[1];
    const v2x=c[0]-b[0], v2y=c[1]-b[1];
    const l1=Math.hypot(v1x,v1y)||1, l2=Math.hypot(v2x,v2y)||1;
    const dot=Math.max(-1,Math.min(1,(v1x*v2x+v1y*v2y)/(l1*l2)));
    return Math.acos(dot)/Math.PI;
  }



  function openingInsideBias(si){
    // Generic early-corner preparation, not a map-coordinate shortcut. Search
    // forward for the next meaningful turn and hug that turn's inside edge
    // progressively while still on the preceding straight. This makes long
    // approaches naturally form a smooth diagonal/arc instead of centre -> 90°.
    let foundSide=0, foundPower=0, distance=99;
    for(let k=0;k<7;k++){
      const idx=Math.min(route.length-2,si+k);
      const side=cornerInsideSide(idx);
      const power=cornerIntensity(idx);
      if(side!==0 && power>.035){ foundSide=side; foundPower=power; distance=k; break; }
    }
    if(!foundSide) return 0;
    const proximity=Math.max(0,1-distance/7);
    return foundSide*Math.min(.995,.58+proximity*.31+Math.min(.10,foundPower*.34));
  }



  function predictedObserverX(o,t){
    const vx=o.phase==="move"?(o.vx||0):0;
    const remain=o.phase==="move"?Math.max(0,((o.phaseUntil||observerPredictionNow)-observerPredictionNow)/1000):0;
    return Math.max(2.5,Math.min(MAP_W-2.5,o.x+vx*Math.min(t,remain||t)));
  }
  function predictedObserverY(o,t){
    const vy=o.phase==="move"?(o.vy||0):0;
    const remain=o.phase==="move"?Math.max(0,((o.phaseUntil||observerPredictionNow)-observerPredictionNow)/1000):0;
    return Math.max(2.5,Math.min(MAP_H-2.5,o.y+vy*Math.min(t,remain||t)));
  }

  const OBS_PRED_X=AVOID_HORIZONS.map(()=>new Float32Array(OBSERVER_COUNT));
  const OBS_PRED_Y=AVOID_HORIZONS.map(()=>new Float32Array(OBSERVER_COUNT));
  let observerPredictionNow=0;

  function precomputeObserverPredictions(now=performance.now()){
    observerPredictionNow=now;
    for(let hi=0;hi<AVOID_HORIZONS.length;hi++){
      const t=AVOID_HORIZONS[hi];
      const px=OBS_PRED_X[hi],py=OBS_PRED_Y[hi];
      for(let i=0;i<observers.length;i++){
        const o=observers[i];
        let moveT=0;
        if(o.phase==="move"){
          const remain=Math.max(0,((o.phaseUntil||now)-now)/1000);
          moveT=Math.min(t,remain);
        }
        const vx=o.phase==="move"?(o.vx||0):0;
        const vy=o.phase==="move"?(o.vy||0):0;
        let x=o.x+vx*moveT,y=o.y+vy*moveT;
        if(x<2.5)x=2.5;else if(x>MAP_W-2.5)x=MAP_W-2.5;
        if(y<2.5)y=2.5;else if(y>MAP_H-2.5)y=MAP_H-2.5;
        px[o.id]=x;py[o.id]=y;
      }
    }
  }

  function candidateAvoidanceRisk(p,s,targetOff,speedMul,nearby){
    const horizons=AVOID_HORIZONS;
    const lateralNow=((p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny);
    let minClearSq=1e9;
    let danger=0;

    for(let hi=0;hi<horizons.length;hi++){
      const t=horizons[hi];
      const blend=Math.min(1,t/0.72);
      const off=lateralNow+(targetOff-lateralNow)*blend;
      const forward=p.speed*speedMul*t;
      const px=p.x+s.ux*forward+s.nx*(off-lateralNow);
      const py=p.y+s.uy*forward+s.ny*(off-lateralNow);
      const predX=OBS_PRED_X[hi], predY=OBS_PRED_Y[hi];

      for(let oi=0;oi<nearby.length;oi++){
        const o=nearby[oi];
        const dx=px-predX[o.id], dy=py-predY[o.id];
        const d2=dx*dx+dy*dy;
        if(d2<minClearSq) minClearSq=d2;

        // v2.53: moving observers get extra safety margin. A stopped observer is
        // predictable, so the racer is allowed to cut slightly closer to it.
        const phaseRemain=Math.max(0,((o.phaseUntil||observerPredictionNow)-observerPredictionNow)/1000);
        const motionRisk=o.phase==="move"
          ? (phaseRemain<.70 ? .94 : 1.18)
          : (phaseRemain<.38 ? 1.34 : .82);
        if(d2<4.0) danger += (4.0-d2)*118*motionRisk;
        else if(d2<16.0) danger += (16.0-d2)*12.4*motionRisk;
        else if(d2<49.0) danger += (49.0-d2)*0.80*motionRisk;
        else if(d2<100.0) danger += (100.0-d2)*0.065*motionRisk;
      }
    }

    const situationRisk=Math.max(0,Math.min(.48,p.tacticalRisk||0));
    const id=identityOf(p), safetyBias=id.safety||1;
    const survival=p.survivalNorm||0;
    // Better survival stats value clearance more strongly. The price is that
    // detours are penalized less, so these racers willingly travel farther.
    const progressRatio=Math.max(0,Math.min(1,currentProgress(p)/routeLength));
    // v4.51 EARLY SURVIVAL AI: strengthen only the pre-shelter decision window.
    // No invulnerability/speed rubber-band: racers simply recognize dangerous approach
    // a little earlier and prefer a slightly larger predicted clearance before shelter 1.
    const preShelterSafety=progressRatio<.56 ? 1.12 : (progressRatio<.64 ? 1.045 : 1);
    const survivalSafety=(1.36+survival*.84)*identityOf(p).safety*preShelterSafety; // v4.59.3: keep reliable clearance slightly ahead of raw lap distance
    const timeLoss=(1-speedMul)*(19.0+situationRisk*7.0)/Math.max(.90,safetyBias);
    const detour=Math.abs(targetOff-p.desiredOffset)*0.165*(2-safetyBias)*(1-survival*.70); // v4.59.3: safe detours remain cheap, but pointless wandering costs a little more
    return {score:danger*safetyBias*survivalSafety+timeLoss+detour,minClear:Math.sqrt(minClearSq)};
  }

  function observerGapPassPlan(p,s,nearby){
    // v2.60: detect a usable moving gap between two observers ahead.
    // Skilled/confident racers may thread the middle instead of taking a large detour.
    if(!nearby || nearby.length<2) return null;
    const skill=Math.max(0,Math.min(1,
      (((p.stats.avoidance+p.stats.reaction+p.stats.prediction+p.stats.control)/4)-72)/27));
    const confidence=Math.max(0,Math.min(1,p.cleanConfidence||0));
    const minGap=1.52 - skill*.20 - confidence*.08; // still comfortably above 2*0.34 hit radius
    let best=null;
    for(let i=0;i<nearby.length;i++){
      const a=nearby[i];
      const adx=a.x-p.x, ady=a.y-p.y;
      const aa=adx*s.ux+ady*s.uy, al=adx*s.nx+ady*s.ny;
      if(aa<2.0 || aa>12.5) continue;
      for(let j=i+1;j<nearby.length;j++){
        const b=nearby[j];
        const bdx=b.x-p.x, bdy=b.y-p.y;
        const ba=bdx*s.ux+bdy*s.uy, bl=bdx*s.nx+bdy*s.ny;
        if(ba<2.0 || ba>12.5 || Math.abs(aa-ba)>4.2) continue;
        const gap=Math.abs(al-bl);
        if(gap<minGap || gap>7.8) continue;
        const mid=(al+bl)*.5;
        const centerCost=Math.abs(mid-p.desiredOffset);
        const score=centerCost + Math.abs(aa-ba)*.22 - gap*.18;
        if(!best || score<best.score) best={targetOff:mid,gap,score};
      }
    }
    if(!best) return null;
    const takeChance=Math.min(.93,.52+skill*.25+confidence*.16);
    if(Math.random()>takeChance) return null;
    return {targetOff:best.targetOff,speedMul:.995,gap:best.gap};
  }

  function escapeGatePlan(p,s,nearby){
    if(!nearby||nearby.length<2) return null;
    const half=Math.max(2.3,widths[Math.min(p.seg,widths.length-1)]*.58);
    const lanes=[-.92,-.62,-.32,0,.32,.62,.92];
    let best=null;
    for(const frac of lanes){
      const off=frac*half;
      let score=0,minClear=99,frontCount=0;
      for(const o of nearby){
        const dx=o.x-p.x,dy=o.y-p.y;
        const along=dx*s.ux+dy*s.uy;
        if(along<-.5||along>13.5) continue;
        const lat=dx*s.nx+dy*s.ny;
        const clear=Math.abs(lat-off);
        minClear=Math.min(minClear,clear);
        if(along>0&&along<9.5&&clear<2.4) frontCount++;
        score+=Math.max(0,3.5-clear)*(along>0&&along<9.5?3.2:1.0);
      }
      score+=Math.abs(off-p.desiredOffset)*.14;
      if(!best||score<best.score) best={targetOff:off,score,minClear,frontCount};
    }
    if(!best||best.frontCount>2||best.minClear<.72) return null;
    return {targetOff:best.targetOff,speedMul:.985,minClear:best.minClear,score:best.score};
  }

  function naturalSurvivalWeave(p,s,now,nearby){
    if(!nearby?.length) return null;
    const si=Math.min(p.seg,segs.length-1);
    const roadHalf=Math.max(3.4,widths[si]*.64);
    let front=0,leftRisk=0,rightRisk=0,centerRisk=0,nearest=999;
    for(const o of nearby){
      const dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy,lat=dx*s.nx+dy*s.ny;
      if(along<-.6||along>17.5) continue;
      const d=Math.hypot(dx,dy); nearest=Math.min(nearest,d);
      const w=Math.max(.15,1-along/18)*Math.max(.18,1-Math.abs(lat)/(roadHalf+5));
      front+=w;
      if(lat<-.3) leftRisk+=w; else if(lat>.3) rightRisk+=w; else centerRisk+=w*1.35;
    }
    if(front<.52) return null;
    const skill=Math.max(0,Math.min(1,((p.stats.avoidance+p.stats.reaction+p.stats.prediction+p.stats.control)/4-72)/27));
    const trigger=Math.min(.92,.62+skill*.20+Math.min(.06,front*.012));
    if(Math.random()>trigger && nearest>10.8) return null;
    const side=leftRisk<rightRisk?-1:rightRisk<leftRisk?1:(p.avoidLastSide|| (Math.random()<.5?-1:1));
    const pressure=Math.min(1,front*.40+centerRisk*.26+(nearest<8.5?.28:0));
    const target=side*roadHalf*(.48+pressure*.30);
    return {targetOff:target,speedMul:nearest<5.0?.96:.994,
      until:now+480+skill*250+Math.min(180,front*35),nearest,front};
  }

  function packAwareness(p,s){
    // v3.63: racers are non-solid, but overlapping racers share danger information.
    // A dense pack should see an observer field earlier rather than blindly copying
    // the same optimal line into the same obstacle.
    let mates=0, frontMates=0, lateralSum=0;
    for(let i=0;i<players.length;i++){
      const q=players[i];
      if(q===p||q.done) continue;
      const dx=q.x-p.x,dy=q.y-p.y;
      const along=dx*s.ux+dy*s.uy, lat=dx*s.nx+dy*s.ny;
      if(Math.abs(along)<7.8 && Math.abs(lat)<5.8){
        mates++;
        lateralSum+=lat;
        if(along>0&&along<6.8) frontMates++;
      }
    }
    const density=Math.min(1,mates/4);
    return {mates,frontMates,density,lateralMean:mates?lateralSum/mates:0};
  }

  function rolloutActionRisk(p,s,targetOff,speedMul,nearby){
    // v4.11 MICRO-ROLLOUT AI: instead of rating only fixed future snapshots,
    // actually simulate a short candidate action sequence. Better prediction/control
    // evaluates farther and more densely, so elite racers can survive OBS100 without
    // shrinking the real hit radius.
    const predN=Math.max(0,Math.min(1,(p.stats.prediction-72)/27));
    const avoidN=Math.max(0,Math.min(1,(p.stats.avoidance-72)/27));
    const reactN=Math.max(0,Math.min(1,(p.stats.reaction-72)/27));
    const controlN=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const skill=(predN+avoidN+reactN+controlN)/4;
    const horizon=2.20+predN*1.42+avoidN*.72;
    const steps=12+Math.round(predN*9+controlN*4+reactN*3);
    const dt=horizon/steps;
    let x=p.x,y=p.y;
    let lateral=((p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny);
    let vx=s.ux*p.speed*speedMul, vy=s.uy*p.speed*speedMul;
    let danger=0,minClear=99;
    const hit=playerHitRadius764(p);
    for(let k=1;k<=steps;k++){
      const t=k*dt;
      // steering cannot teleport laterally: approach the selected lane progressively.
      const steerRate=(.41+controlN*.38+reactN*.24);
      lateral += (targetOff-lateral)*Math.min(1,steerRate*dt*2.2);
      x += vx*dt + s.nx*(targetOff-lateral)*dt*.38;
      y += vy*dt + s.ny*(targetOff-lateral)*dt*.38;
      let stepThreats=0, stepPressure=0;
      for(const o of nearby){
        const ox=predictedObserverX(o,t), oy=predictedObserverY(o,t);
        const d=Math.hypot(x-ox,y-oy);
        if(d<minClear) minClear=d;
        const clearance=d-hit;
        if(d<4.4){ stepThreats++; stepPressure+=Math.max(0,4.4-d); }
        if(clearance<0) danger += 26000+(Math.abs(clearance)+.05)*12000;
        else if(clearance<.62) danger += (0.62-clearance)*1900;
        else if(clearance<1.45) danger += (1.45-clearance)*220;
        else if(clearance<2.8) danger += (2.8-clearance)*16;
      }
      // v4.54: overlapping threats compound risk instead of being treated independently.
      if(stepThreats>=2) danger += stepPressure*(stepThreats-1)*(46+avoidN*28+predN*24);
    }
    // reward forward pace; elite racers accept narrower safe windows but never ignore a collision.
    const paceReward=speedMul*(5.8+skill*2.7);
    const steerCost=Math.abs(targetOff-p.desiredOffset)*(.10+(1-controlN)*.08);
    return {score:danger+steerCost-paceReward,minClear};
  }

  
  // v7.24 removed dead legacy AI: humanLiveEvadeController


  
  
  // v4.68 DRIVER STYLE 2.0:
  // Styles no longer choose intentionally slow macro routes. They change how precisely
  // and how boldly each racer executes the same shortest inside line.
  
  // v4.70-v4.74 INTEGRATED FAST-RACE AI
  // 4.70 inside-line 3.0 / 4.71 turn-in timing 3.0 / 4.72 linked corners 3.0
  // 4.73 straight driving 2.0 / 4.74 leader AI 3.0.
  function linkedCornerPlan74(si,maxLook=4){
    const out=[];
    for(let k=0;k<=maxLook;k++){
      const sj=Math.min(segs.length-1,si+k);
      const power=cornerIntensity(sj),side=cornerInsideSide(sj);
      if(side && power>.028) out.push({sj,gap:k,power,side});
    }
    return out;
  }

  function integratedFastLine74(p,si,baseOff){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[idx],half=Math.max(1.8,widths[idx]*ROAD_MARGIN*.965);
    const rx=p.x-s.a[0],ry=p.y-s.a[1];
    const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
    const phase=s.L?along/s.L:1;
    const corners=linkedCornerPlan74(idx,4);
    const insideN=Math.max(0,Math.min(1,(p.stats.insideLine-72)/27));
    const cornerN=Math.max(0,Math.min(1,(p.stats.cornering-72)/27));
    const readN=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
    const controlN=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const precision=insideN*.34+cornerN*.29+readN*.22+controlN*.15;
    let target=baseOff,authority=.82;

    if(corners.length){
      const c=corners[0];
      // 4.71: turn in only when the inside line is geometrically useful; no early exterior setup.
      const approach=Math.max(0,Math.min(1,(4.15-c.gap)/4.15));
      const edge=Math.min(.998,.925+precision*.068);
      const insideTarget=c.side*half*edge;
      if(c.gap===0){
        const turnIn=Math.max(0,Math.min(1,(phase+.10)/.28));
        target=baseOff*(1-turnIn)+insideTarget*turnIn;
        authority=.91+precision*.06;
      }else{
        target=insideTarget;
        authority=Math.min(.94,.42+approach*.43+readN*.07);
      }

      // 4.72: linked corners are one sequence. Stay on current inside for same-direction
      // bends; cross toward the next inside only late enough for an opposite S-bend.
      const next=corners.find(x=>x.sj>c.sj);
      if(next && c.gap===0){
        if(next.side===c.side){
          target=insideTarget;
          authority=Math.max(authority,.94);
        }else if(phase>.76){
          const t=Math.min(1,(phase-.76)/.24);
          const nextInside=next.side*half*(.78+readN*.15);
          target=insideTarget*(1-t*.52)+nextInside*(t*.52);
        }
      }
    }else{
      // 4.73: straight = shortest stable continuation. No decorative lane weaving.
      target=baseOff;
      authority=.94;
    }
    return clampRoadOffset(idx,baseOff*(1-authority)+target*authority,p);
  }



  // v4.67 SURVIVAL × RACING UNIFIED POLICY:
  // Avoidance may leave the fast line only when the predicted threat justifies it.
  // Leaders/P2 in a close fight pay an extra route-cost penalty, so they make compact
  // dodges and return to the racing line immediately instead of taking huge arcs.









  // v2.13: dedicated overtake/comeback planner.
  // It never gives a trailing racer extra base speed. It only changes line choice,
  // timing, and risk according to the next corner and observer layout.


  // v4.65 OVERTAKE AI 1.0:
  // Read the actual racer ahead, compare open left/right lanes and the next 2-3
  // corners, then commit to a pass corridor. Racers remain non-solid; this is
  // tactical route choice, not collision physics or rubber-band speed.
  
  // v4.75-v4.79 INTEGRATED RACE AI
  // 4.75 chase 2.0 / 4.76 overtake 2.0 / 4.77 side-by-side 2.0
  // 4.78 rejoin 4.0 / 4.79 racing line 4.0.
  //
  // Fast-side calibration from actual map geometry:
  // 7->5 o'clock: upper corridor, 3->9 o'clock: upper corridor,
  // final 11->1 o'clock: lower corridor. Edge rows remain fully legal road.
  
function calibratedFastCorridor79(si){
    // v4.95: disabled.
    // The old calibration forcibly pulled long horizontal corridors toward a selected
    // screen-side edge. That is exactly what caused racers to leave an already-fast
    // horizontal line and make a pointless vertical move to the one-row edge.
    return null;
  }

  function raceLine79(p,si,baseOff,passActive=false){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const half=Math.max(1.8,widths[idx]*ROAD_MARGIN*.965);
    const calibrated=calibratedFastCorridor79(idx);
    let target=baseOff;

    if(calibrated){
      // These long corridors have an obvious shortest screen-side line.
      // Normal racing strongly commits to it; a genuine pass may deviate modestly.
      const authority=passActive?.58:.94;
      target=target*(1-authority)+calibrated.off*authority;
    }

    // 4.79 global anti-exterior rule: outside of the calibrated corridors,
    // do not create a large lane excursion unless traffic really blocks the route.
    const macro=integratedFastLine74(p,idx,cornerPhysics64Target(
      p,idx,optimalRacingLine2Offset(p,idx)).off);
    const maxDev=half*(passActive?.52:.26);
    const d=target-macro;
    if(Math.abs(d)>maxDev && !calibrated){
      target=macro+Math.sign(d)*maxDev;
    }
    return clampRoadOffset(idx,target,p);
  }



  


  // v4.66 MULTI-CAR RACING LINE 2.0
  // Solo/leader: keep the globally optimal 4.64 line.
  // Chaser/pack: only leave it when another racer really occupies the useful corridor.
  // Side-by-side: hold distinct corridors briefly instead of repeatedly crossing.
  // Racers are still non-solid; there is no push, contact slowdown or rubber-banding.


  // v2.27: read the current corner together with the next meaningful corner.
  // This builds approach -> apex -> exit/preparation behavior instead of treating
  // every segment as an isolated turn.
  function racingCornerSequence(si){
    const cur=Math.min(si,segs.length-1);
    let currentSide=cornerInsideSide(cur);
    let currentPower=cornerIntensity(cur);
    let nextSide=0,nextPower=0,nextIndex=-1;

    for(let j=cur+1;j<Math.min(segs.length-1,cur+6);j++){
      const side=cornerInsideSide(j);
      const power=cornerIntensity(j);
      if(side!==0 && power>.035){
        nextSide=side;
        nextPower=power;
        nextIndex=j;
        break;
      }
    }
    return {currentSide,currentPower,nextSide,nextPower,nextIndex};
  }







  // v4.49 CORNER / INSIDE-LINE FINALIZER:
  // Build one continuous entry -> apex -> exit decision from route geometry.
  // High Cornering / Inside Line / Route Reading racers commit earlier and closer
  // to the legal inside edge. The next corner is considered before the current
  // corner ends, so S-bends connect without a centre-line snap. Observer avoidance
  // is applied later and always retains final authority.







  // v4.64 CORNERING PHYSICS 2.0 + OPTIMAL RACING LINE 2.1
  // The map-wide solver now models corner entry, apex and exit separately. It
  // classifies bend severity, rewards outside -> inside -> outside geometry, and
  // looks through linked corners so the exit of one bend becomes the entry of the next.
  let racingLine2Cache=null;
  function cornerClass64(si){
    const power=cornerIntensity(si);
    if(power>=.30) return {name:"hairpin",power,entry:.96,apex:.995,exit:.88,speed:.936};
    if(power>=.205) return {name:"sharp",power,entry:.90,apex:.992,exit:.82,speed:.958};
    if(power>=.125) return {name:"medium",power,entry:.80,apex:.982,exit:.74,speed:.978};
    if(power>=.055) return {name:"sweeper",power,entry:.65,apex:.945,exit:.62,speed:.992};
    return {name:"straight",power,entry:0,apex:0,exit:0,speed:1};
  }

  function nextMeaningfulCorner64(si,maxLook=5){
    for(let k=1;k<=maxLook;k++){
      const idx=Math.min(route.length-2,si+k);
      const side=cornerInsideSide(idx), cls=cornerClass64(idx);
      if(side && cls.power>=.055) return {idx,side,cls,gap:k};
    }
    return null;
  }

  function buildOptimalRacingLine2(){
    if(racingLine2Cache) return racingLine2Cache;
    const fracs=[-.985,-.90,-.81,-.72,-.63,-.54,-.45,-.36,-.27,-.18,-.09,0,.09,.18,.27,.36,.45,.54,.63,.72,.81,.90,.985];
    const K=fracs.length,N=segs.length;
    const nodes=Array.from({length:N},(_,i)=>{
      const s=segs[i],half=Math.max(2.0,widths[i]*ROAD_MARGIN*.972);
      return fracs.map(f=>({off:f*half,x:s.b[0]+s.nx*f*half,y:s.b[1]+s.ny*f*half,frac:f}));
    });
    const INF=1e30;
    let dp=Array.from({length:K},()=>Array(K).fill(INF));
    const back=Array.from({length:N},()=>Array.from({length:K},()=>Array(K).fill(-1)));
    const start={x:route[0][0],y:route[0][1]};
    for(let b=0;b<K;b++){
      const q=nodes[0][b];
      if(!lineStaysOnCourse(start.x,start.y,q.x,q.y,ROUTE_PLAN_EXTRA*.72)) continue;
      const d=Math.hypot(q.x-start.x,q.y-start.y);
      const nc=nextMeaningfulCorner64(0,5);
      // v4.94: shortest-path game — no outside-entry reward on a clear straight.
      // Future corners may affect steering later, but never justify a slower dogleg now.
      const entryBonus=0;
      dp[b][b]=d+entryBonus;
    }
    for(let i=1;i<N;i++){
      const ndp=Array.from({length:K},()=>Array(K).fill(INF));
      for(let a=0;a<K;a++) for(let b=0;b<K;b++){
        const base=dp[a][b]; if(base>=INF) continue;
        const prev=i===1?start:nodes[i-2][a];
        const cur=nodes[i-1][b];
        const v1x=cur.x-prev.x,v1y=cur.y-prev.y;
        const l1=Math.hypot(v1x,v1y)||1;
        for(let c=0;c<K;c++){
          const nxt=nodes[i][c];
          if(!lineStaysOnCourse(cur.x,cur.y,nxt.x,nxt.y,ROUTE_PLAN_EXTRA*.72)) continue;
          const v2x=nxt.x-cur.x,v2y=nxt.y-cur.y;
          const l2=Math.hypot(v2x,v2y)||1;
          const dot=Math.max(-1,Math.min(1,(v1x*v2x+v1y*v2y)/(l1*l2)));
          const ang=Math.acos(dot);
          const cls=cornerClass64(i), side=cornerInsideSide(i);
          // Steering loss grows superlinearly in sharper bends. Abrupt zig-zags are
          // expensive, while a long smooth arc can beat the raw shortest chord.
          let cost=base+l2+ang*ang*(4.25+cls.power*7.8);
          if(side && cls.power>=.055){
            // v4.94: never reward an outside/dogleg entry. Reward only a useful
            // inside apex; the route solver should minimize geometric path length first.
            cost += -side*nxt.frac*cls.power*(.42+.48*cls.apex);
          }
          const future=nextMeaningfulCorner64(i,3);
          if(future){
            // Exit toward the outside of the current bend unless a close linked
            // corner needs the opposite side. For S-bends, that same exit naturally
            // becomes the outside entry of the following corner.
            const w=future.cls.power*(future.gap===1?.10:future.gap===2?.055:.025); // v4.94 minimal anticipation
            cost += future.side*nxt.frac*w;
          }
          // Wide straights should not default to centre. Lane changes are penalized
          // only when they add distance without preparing a meaningful bend.
          if(cls.power<.055) cost += Math.abs(nxt.frac-cur.frac)*.34; // v4.94 straight-line discipline
          if(cost<ndp[b][c]){ndp[b][c]=cost;back[i][b][c]=a;}
        }
      }
      dp=ndp;
    }
    let ba=0,bb=0,best=INF;
    for(let a=0;a<K;a++) for(let b=0;b<K;b++) if(dp[a][b]<best){best=dp[a][b];ba=a;bb=b;}
    const chosen=Array(N).fill(0);
    if(N===1){chosen[0]=bb;}
    else{
      chosen[N-2]=ba; chosen[N-1]=bb;
      for(let i=N-1;i>=2;i--){
        const a=back[i][chosen[i-1]][chosen[i]];
        chosen[i-2]=a<0?Math.floor(K/2):a;
      }
    }
    racingLine2Cache=chosen.map((k,i)=>nodes[i][k].off);
    return racingLine2Cache;
  }

  function optimalRacingLine2Offset(p,si){
    const line=buildOptimalRacingLine2();
    si=Math.max(0,Math.min(line.length-1,si));
    const base=line[si]||0;
    // Individuality remains execution quality around the same fast macro line.
    const skill=Math.max(0,Math.min(1,((p.stats.cornering+p.stats.insideLine+p.stats.routeReading+p.stats.control)/4-72)/27));
    const half=Math.max(1.8,widths[si]*ROAD_MARGIN);
    const signature=Math.sin((si+1)*.61+(p.routeIdentityPhase||0))*half*(.003+(1-skill)*.008);
    return clampRoadOffset(si,base+signature,p);
  }

  function cornerPhysics64Target(p,si,baseOff){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[idx];
    const cls=cornerClass64(idx), side=cornerInsideSide(idx);
    const rx=p.x-s.a[0],ry=p.y-s.a[1];
    const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
    const phase=s.L?along/s.L:1;
    const half=Math.max(1.8,widths[idx]*ROAD_MARGIN*.965);
    const cornerN=Math.max(0,Math.min(1,(p.stats.cornering-72)/27));
    const insideN=Math.max(0,Math.min(1,(p.stats.insideLine-72)/27));
    const readN=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
    const controlN=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const brakingN=Math.max(0,Math.min(1,(p.stats.braking-72)/27));
    const skill=cornerN*.32+insideN*.28+readN*.20+controlN*.14+brakingN*.06;
    let target=baseOff,weight=0,speedMul=1;

    // v4.68 SHORTEST-INSIDE CORNERING:
    // This game rewards path length, not car-tyre realism. Do not swing outside first.
    // Attach to the legal inside edge early, skim it through the bend, and only release
    // as much as the next route geometry actually requires.
    if(side && cls.power>=.035){
      const edgeCommit=Math.min(.998,.925+insideN*.050+cornerN*.018);
      const insideEdge=side*half*edgeCommit;
      if(phase<.22){
        // Early entry: already move strongly toward the inside instead of opening wide.
        const t=phase/.22;
        const early=side*half*(.76+insideN*.17+readN*.04);
        target=baseOff*(1-t)+early*t;
        weight=.78+cls.power*.40;
      }else if(phase<.82){
        // Hold the shortest legal arc for most of the corner.
        target=insideEdge;
        weight=.88+Math.min(.10,cls.power*.22);
      }else{
        const future=nextMeaningfulCorner64(idx,3);
        if(future && future.side!==side){
          // S-bend: cross only when the next inside line actually becomes useful.
          const t=(phase-.82)/.18;
          const nextInside=future.side*half*(.70+readN*.20);
          target=insideEdge*(1-t*.46)+nextInside*(t*.46);
          weight=.82;
        }else{
          // Same-direction / clear exit: keep hugging inside; no decorative outside exit.
          target=insideEdge;
          weight=.90;
        }
      }

      const minSpeed=cls.speed;
      const skillSave=(1-minSpeed)*Math.min(.92,skill*.78+cornerN*.14);
      speedMul=Math.min(1,minSpeed+skillSave);
      const apexLoad=Math.max(0,1-Math.abs(phase-.52)/.52);
      speedMul=1-(1-speedMul)*apexLoad;
    }else{
      // Straight: if a meaningful bend is coming soon, prepare on its INSIDE side early.
      const future=nextMeaningfulCorner64(idx,4);
      if(future){
        const proximity=Math.max(0,1-(future.gap-1)/4);
        const earlyInside=future.side*half*(.72+insideN*.14+readN*.08);
        const w=Math.min(.88,(.30+.50*proximity)*(.86+.14*readN));
        target=baseOff*(1-w)+earlyInside*w;
        weight=.92;
      }
    }
    return {off:clampRoadOffset(idx,baseOff*(1-Math.min(.98,weight))+target*Math.min(.98,weight),p),speedMul,type:cls.name};
  }








  // v2.14: start / finish / clutch situation logic.
  // No trailing-speed bonus: late-race changes are route/risk/decision changes only.



  // v4.48 START AI: racers still spawn at exactly the same v6.04 start-safe coordinate. Start, Reaction,
  // Acceleration and personality decide how quickly and how strongly each racer fans into
  // a legal opening line. Observer avoidance below always has final authority.


  
  // v4.80-v4.84 INTEGRATED OBSERVER AI
  // 4.80 future-threat prediction 3.0 / 4.81 minimum dodge 2.0 /
  // 4.82 inside-line preservation / 4.83 multi-observer escape corridor 3.0 /
  // 4.84 instant optimal-line rejoin 5.0.


  function predictedThreatSet84(p,s,now,r=26){
    const raw=playerPerceivedObservers(p,r,now);
    const out=[];
    for(const o of raw){
      const dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy;
      const lat=dx*s.nx+dy*s.ny;
      if(along<-3.0 || along>24.0) continue;
      const rvx=(o.vx||0)-s.ux*p.speed;
      const rvy=(o.vy||0)-s.uy*p.speed;
      const rv2=rvx*rvx+rvy*rvy;
      let tc=99,cpa=Math.hypot(dx,dy);
      if(rv2>.01){
        tc=Math.max(0,Math.min(3.6,-(dx*rvx+dy*rvy)/rv2));
        cpa=Math.hypot(dx+rvx*tc,dy+rvy*tc);
      }
      // 4.80: only projected conflict / genuinely occupied forward space is a threat.
      const projected=tc<(startBoost816?3.8:3.45) && cpa<(startBoost816?6.1:5.4);
      const occupied=along>-.6 && along<(startBoost816?15.0:12.5) && Math.abs(lat)<(startBoost816?5.2:4.6);
      if(projected || occupied) out.push({o,along,lat,tc,cpa});
    }
    out.sort((a,b)=>(a.tc-b.tc)||(a.cpa-b.cpa));
    return out;
  }





  // v4.85-v4.89 RACE AI 5.0 COMPLETION
  // 4.85 leader survival 2.0 / 4.86 human judgment 3.0 /
  // 4.87 stat-driven execution 3.0 / 4.88 unified situation score 4.0 /
  // 4.89 final race-AI balance and anti-abnormal-routing pass.






  // v5.01 HORIZONTAL CENTERLINE LOCK



  // v5.03 HORIZONTAL SEGMENT HOLD
  // Preserve the current horizontal segment until its endpoint is genuinely reached.
  // This prevents early segment switching from pulling the target vertically.



  // v5.07 BROAD-ROAD CORRIDOR ENGINE
  // Edge rows remain legal drivable road, but they are NOT the default reference line.
  // On broad road, calm racing prefers a center/shortest visible chord through the
  // whole road surface. Edge lines are reserved for real tactical/avoidance use.
  function roadChordLegal507(x1,y1,x2,y2,extra=ROUTE_PLAN_EXTRA){
    const dist=Math.hypot(x2-x1,y2-y1);
    const n=Math.max(3,Math.ceil(dist/.50));
    for(let k=1;k<=n;k++){
      const t=k/n;
      if(!courseContainsPoint(x1+(x2-x1)*t,y1+(y2-y1)*t,extra)) return false;
    }
    return true;
  }


  // v5.08 MAP-SPECIFIC FAST HORIZONTAL LINES
  // Middle 3->9 corridor: prefer the upper side of the broad road.
  // Final 11->1 corridor: after the last corner, hold the exit Y and drive
  // horizontally all the way to the finish instead of re-targeting downward/upward.







  // v5.13 INTEGRATED STABILITY (v5.10~v5.13)


  // v5.16 INTEGRATED CORNER + DRIVE LAYER (v5.14~v5.16)
  // v5.14: corner-entry stability
  // v5.15: corner-exit stability
  // v5.16: route planning is separated from final steering/movement shaping

  function cornerPhase516(p,si){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[idx];
    const next=segs[Math.min(segs.length-1,idx+1)];
    const prev=segs[Math.max(0,idx-1)];

    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
    const frac=s.L>0 ? along/s.L : 0;

    const nextTurn=next ? Math.abs(s.ux*next.uy-s.uy*next.ux) : 0;
    const prevTurn=prev ? Math.abs(prev.ux*s.uy-prev.uy*s.ux) : 0;

    return {
      frac,
      entering: nextTurn>.08 && frac>.68,
      exiting: prevTurn>.08 && frac<.34,
      straight: nextTurn<.055 && prevTurn<.055
    };
  }


  // v5.16 final steering layer.
  // Route/planner code may decide a desired target, but only this function converts it
  // into the local movement target used by the movement engine.



  // v5.19 INTEGRATED DIAGNOSTICS + STABILITY (v5.17~v5.19)







  function drawDebugHud519(ctx){
    const p=players && players.length ? players[0] : null;
    if(!p || !p.debug519) return;
    const d=p.debug519;
    ctx.save();
    ctx.globalAlpha=.90;
    ctx.fillStyle="rgba(0,0,0,.68)";
    ctx.fillRect(8,8,260,92);
    ctx.fillStyle="#fff";
    ctx.font="12px monospace";
    ctx.textBaseline="top";
    ctx.fillText("v5.19 DRIVE DEBUG",16,14);
    ctx.fillText("P1 seg "+d.seg+" "+d.mode+"  "+d.source,16,31);
    ctx.fillText("route "+d.rx.toFixed(1)+","+d.ry.toFixed(1),16,48);
    ctx.fillText("steer "+d.sx.toFixed(1)+","+d.sy.toFixed(1),16,64);
    ctx.fillText("move  "+d.mx.toFixed(2)+","+d.my.toFixed(2),16,80);
    if((p.anomalyUntil519||0)>performance.now() && p.lastAnomaly519){
      ctx.fillStyle="#ffdf6b";
      ctx.fillText("! "+p.lastAnomaly519.reason,178,31);
    }
    ctx.restore();
  }




  
  // v7.24 removed dead legacy AI: avoidance330


  function forceStartCenter625(p){
    const m810=currentMap770();
    const sp=(m810.id==='triple_diamond'&&Array.isArray(m810.dualStarts810))
      ? m810.dualStarts810[(Number.isInteger(p._dgStartIndex813)&&p._dgStartIndex813>=0)?p._dgStartIndex813:((p.index||0)<Math.ceil(players.length/2)?0:1)]
      : mapStart770(),sx=sp.x,sy=sp.y;
    p.x=sx; p.y=sy;
    p.prevX=sx; p.prevY=sy;
    p.simPrevX=sx; p.simPrevY=sy;
    p.lastX=sx; p.lastY=sy;
    p.mouseTargetX=sx; p.mouseTargetY=sy;
    p.seg=0;
    p.lastProgress=0;
    p._lastLegal619={x:sx,y:sy};
    p._steer617={x:sx,y:sy};
    // v7.10: normal racing no longer fans out by identity.
    p.openingLineBias=0;
    p.routeBand=0;
    p.routeIdentityBias=0;
    p.laneSignatureWave=0;
  }


  // ============================================================
  // v6.36 CORE RULE AUDIT
  // Consolidates the project's non-negotiable rules:
  // - exact yellow-zone center start
  // - auto camera always follows the actual live P1
  // - player-player bodies are non-solid
  // - no rank/speed rubber-band
  // - calm racing = shortest legal road line
  // - avoidance = local/minimum deviation only
  // - physical position may never remain outside the legal road
  // ============================================================





  let raceFrameCache668={stamp:-1,active:[],leader:null,top:[]};
  function rebuildRaceFrameCache668(now){
    const active=[];
    for(const p of players){
      if(p.done||p.dead) continue;
      active.push({p,prog:currentProgress(p)});
    }
    active.sort((a,b)=>b.prog-a.prog);
    raceFrameCache668={stamp:now,active,leader:active[0]?.p||null,top:active.slice(0,4)};
    return raceFrameCache668;
  }







  function sanitizeRaceState666(p){
    if(!p) return false;
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y)){
      const m810=currentMap770();
      const sp770=(m810.id==='triple_diamond'&&Array.isArray(m810.dualStarts810))
        ? m810.dualStarts810[(Number.isInteger(p._dgStartIndex813)&&p._dgStartIndex813>=0)?p._dgStartIndex813:((p.index||0)<Math.ceil(players.length/2)?0:1)]
        : mapStart770();
      p.x=sp770.x;p.y=sp770.y;p.seg=0;
      p.prevX=p.x;p.prevY=p.y;p.simPrevX=p.x;p.simPrevY=p.y;
      p._lastLegal636={x:p.x,y:p.y};p._lastLegal619={x:p.x,y:p.y};
    }
    if(!Number.isFinite(p.seg)) p.seg=0;
    p.seg=Math.max(0,Math.min(segs.length-1,p.seg|0));
    if(p.done&&p.dead) p.dead=false;
    return true;
  }

  function sMapVisualRoadMask770(x,y){
    if(!courseContainsPoint(x,y,0)) return false;
    if(y>=123.2&&y<=142.2&&x>=20.5&&x<=130.5) return true;
    if(x>=119&&x<=137&&y>=72&&y<=134) return true;
    if(y>=64.8&&y<=83.2&&x>=43&&x<=130) return true;
    if(x>=36.2&&x<=51.8&&y>=22&&y<=75.5) return true;
    if(y>=15&&y<=32.2&&x>=42&&x<=144.2) return true;
    for(const c of [[128,132.8,12],[128,74,11.5],[44,74,10.5],[44,23.5,10.5]])
      if(Math.hypot(x-c[0],y-c[1])<=c[2]) return true;
    return false;
  }
  function visualRoadMask674(x,y,si){
    const m=currentMap770(),fn=m.roadMask770;
    if(typeof fn==="function")return !!fn(x,y,si);
    return m.id!=="s_map"?genericCourseMask771(m,x,y,0):false;
  }



  let telemetry696={raceStart:0,lastRanks:new Map(),leaderId:-1,leaderSince:0,leaderChanges:0};

  function ensureTelemetry696(p,now){
    if(!p.telemetry696){
      p.telemetry696={
        startedAt:now,lastX:p.x,lastY:p.y,pathLength:0,
        leaderMs:0,overtakes:0,positionsLost:0,avoidanceCount:0,
        avoidanceSuccess:0,insideErrorSum:0,insideSamples:0,
        maxProgress:currentProgress(p),finishTime:null,deathProgress:null,
        lastAvoidKind:"",lastAvoidAt:0,lastRank:null,

        // v7.40~v7.49 Statistics Engine
        threatReads749:0,evadeAttempts749:0,evadeSuccess749:0,evadeFailures749:0,
        actionCounts749:{side:0,thread:0,diag:0,hard:0,brake:0,stop:0,backcon:0},
        reactionSum749:0,reactionSamples749:0,rejoinSum749:0,rejoinSamples749:0,
        lineDevSum749:0,lineDevMax749:0,lineSamples749:0,
        minObserverGap749:999,dangerMs749:0,highDangerMs749:0,
        lastMode749:"NORMAL",lastAction749:"none",lastModeAt749:now,
        activeEvadeCollision749:0,lastCollision749:0,
        sampleAcc749:0,sector749:0,sectorStarted749:now,
        sectors749:Array.from({length:6},()=>({
          timeMs:0,path:0,threats:0,evades:0,lineDevSum:0,lineSamples:0,minGap:999
        }))
      };
    }
    return p.telemetry696;
  }

  function sectorNames770(){
    return currentMap770().sectorNames||["Sector 1","Sector 2","Sector 3","Sector 4","Sector 5","Sector 6"];
  }

  function sectorIndex749(p){
    const prog=Number.isFinite(p?._splineProg720)?p._splineProg720:0;
    const total=Math.max(1,RACING_SPLINE_SEGS_720?.total||1);
    const r=Math.max(0,Math.min(.999999,prog/total));
    const cuts=currentMap770().sectorCuts||[.17,.34,.51,.68,.84];
    for(let i=0;i<cuts.length;i++)if(r<cuts[i])return i;
    return Math.min(5,cuts.length);
  }

  function evadeBucket749(action){
    const a=String(action||"");
    if(a.includes("side"))return "side";
    if(a.includes("thread"))return "thread";
    if(a.includes("diag"))return "diag";
    if(a.includes("hard"))return "hard";
    if(a.includes("brake"))return "brake";
    if(a.includes("stop"))return "stop";
    if(a.includes("back"))return "backcon";
    return null;
  }

  function noteThreatRead749(p,now){
    const t=ensureTelemetry696(p,now);
    t.threatReads749++;
    const si=sectorIndex749(p);
    if(t.sectors749[si])t.sectors749[si].threats++;
  }

  function noteEvadeStart749(p,now,action){
    const t=ensureTelemetry696(p,now);
    t.evadeAttempts749++; t.avoidanceCount++;
    const b=evadeBucket749(action);
    if(b)t.actionCounts749[b]=(t.actionCounts749[b]||0)+1;
    t.activeEvadeCollision749=p.match?.collisions||0;
    const si=sectorIndex749(p);
    if(t.sectors749[si])t.sectors749[si].evades++;

    const st=p._raceState720;
    if(st && Number.isFinite(st._detectedAt749)){
      const rt=Math.max(0,now-st._detectedAt749);
      if(rt<1000){t.reactionSum749+=rt;t.reactionSamples749++;}
      st._detectedAt749=NaN;
    }
  }

  function noteEvadeEnd749(p,now){
    const t=ensureTelemetry696(p,now);
    const hitNow=p.match?.collisions||0;
    if(hitNow===t.activeEvadeCollision749){t.evadeSuccess749++;t.avoidanceSuccess++;}
    else t.evadeFailures749++;
  }

  function telemetryStep696(now,dt){
    const active=players.slice().filter(p=>!p.dead&&!p.done)
      .sort((a,b)=>currentProgress(b)-currentProgress(a));
    const ranks=new Map();
    active.forEach((p,i)=>ranks.set(p.index,i+1));

    for(const p of players){
      const t=ensureTelemetry696(p,now);
      const d=Math.hypot(p.x-t.lastX,p.y-t.lastY);
      if(Number.isFinite(d)&&d<5)t.pathLength+=d;
      t.lastX=p.x;t.lastY=p.y;
      const prog=currentProgress(p);
      t.maxProgress=Math.max(t.maxProgress,prog);

      const sec=sectorIndex749(p);
      if(t.sectors749[sec]){
        t.sectors749[sec].timeMs+=(!p.dead&&!p.done)?dt:0;
        if(Number.isFinite(d)&&d<5)t.sectors749[sec].path+=d;
      }
      if(sec!==t.sector749){t.sector749=sec;t.sectorStarted749=now;}

      const rk=ranks.get(p.index);
      if(rk!=null&&t.lastRank!=null){
        if(rk<t.lastRank)t.overtakes+=t.lastRank-rk;
        if(rk>t.lastRank)t.positionsLost+=rk-t.lastRank;
      }
      if(rk!=null)t.lastRank=rk;

      // State transitions are nearly free and give exact control usage.
      const rs=p._raceState720;
      const mode=rs?.mode||"NORMAL",action=rs?.action||"none";
      if(mode==="EVADE" && (t.lastMode749!=="EVADE" || action!==t.lastAction749)){
        noteEvadeStart749(p,now,action);
      }
      if(t.lastMode749==="EVADE" && mode!=="EVADE"){
        noteEvadeEnd749(p,now);
        if(mode==="REJOIN")t.lastModeAt749=now;
      }
      if(t.lastMode749==="REJOIN" && mode==="NORMAL"){
        const rj=Math.max(0,now-t.lastModeAt749);
        if(rj<5000){t.rejoinSum749+=rj;t.rejoinSamples749++;}
      }
      if(mode!==t.lastMode749)t.lastModeAt749=now;
      t.lastMode749=mode;t.lastAction749=action;

      // v7.49 performance rule: detailed geometry/observer stats at 10 Hz, not 50 Hz.
      t.sampleAcc749+=dt;
      if(t.sampleAcc749>=100){
        const sampleDt=t.sampleAcc749;t.sampleAcc749=0;
        const dev=Math.abs(Number(p._lineOffset720)||0);
        t.lineDevSum749+=dev;t.lineDevMax749=Math.max(t.lineDevMax749,dev);t.lineSamples749++;
        t.insideErrorSum+=dev;t.insideSamples++;
        if(t.sectors749[sec]){
          t.sectors749[sec].lineDevSum+=dev;t.sectors749[sec].lineSamples++;
        }

        let minGap=999;
        const near=localObservers723(p,6.0);
        for(const o of near)minGap=Math.min(minGap,Math.hypot(p.x-o.x,p.y-o.y));
        if(minGap<999){
          t.minObserverGap749=Math.min(t.minObserverGap749,minGap);
          if(t.sectors749[sec])t.sectors749[sec].minGap=Math.min(t.sectors749[sec].minGap,minGap);
          if(minGap<4.0)t.dangerMs749+=sampleDt;
          if(minGap<2.25)t.highDangerMs749+=sampleDt;
        }
      }

      if(p.done&&t.finishTime==null)t.finishTime=p.finishTime??(now-t.startedAt);
      if(p.dead&&t.deathProgress==null)t.deathProgress=prog;
    }

    const leader=active[0];
    if(leader){
      const lt=ensureTelemetry696(leader,now);
      lt.leaderMs+=dt;
      if(telemetry696.leaderId!==leader.index){
        if(telemetry696.leaderId!==-1)telemetry696.leaderChanges++;
        telemetry696.leaderId=leader.index;telemetry696.leaderSince=now;
      }
    }
    telemetry696.lastRanks=ranks;
  }

  function advancedStats697(p){
    const t=p?.telemetry696;
    if(!t)return null;
    const avgInside=t.insideSamples?t.insideErrorSum/t.insideSamples:0;
    const optimal=Math.max(1,currentProgress(p));
    const attempts=Math.max(0,t.evadeAttempts749||0);
    const avgReaction=t.reactionSamples749?t.reactionSum749/t.reactionSamples749:null;
    const avgRejoin=t.rejoinSamples749?t.rejoinSum749/t.rejoinSamples749:null;
    return {
      leaderShare:Math.max(0,t.leaderMs/Math.max(1,gameNow()-(t.startedAt||0))),
      leaderMs:t.leaderMs,overtakes:t.overtakes,positionsLost:t.positionsLost,
      avoidanceCount:attempts,avoidanceSuccess:t.evadeSuccess749||0,
      avoidanceFailures:t.evadeFailures749||0,
      avoidanceSuccessRate:attempts?(t.evadeSuccess749||0)/attempts:0,
      threatReads:t.threatReads749||0,
      actionCounts:{...(t.actionCounts749||{})},
      avgReactionMs:avgReaction,avgRejoinMs:avgRejoin,
      minObserverGap:t.minObserverGap749<999?t.minObserverGap749:null,
      dangerMs:t.dangerMs749||0,highDangerMs:t.highDangerMs749||0,
      pathLength:t.pathLength,
      racingLineEfficiency:Math.max(0,Math.min(1,optimal/Math.max(optimal,t.pathLength))),
      insideLineAccuracy:Math.max(0,Math.min(1,1-avgInside/2.5)),
      avgLineDeviation:t.lineSamples749?t.lineDevSum749/t.lineSamples749:0,
      maxLineDeviation:t.lineDevMax749||0,
      finishTime:t.finishTime,deathProgress:t.deathProgress,
      sectors:(t.sectors749||[]).map((x,i)=>({
        name:sectorNames770()[i]||`Sector ${i+1}`,timeMs:x.timeMs,path:x.path,threats:x.threats,evades:x.evades,
        avgLineDeviation:x.lineSamples?x.lineDevSum/x.lineSamples:0,
        minObserverGap:x.minGap<999?x.minGap:null
      }))
    };
  }

  function performanceRating749(p,rank=8){
    const a=advancedStats697(p)||{};
    const finish=p.done?1:0;
    const rankScore=Math.max(0,(9-rank)/8);
    const avoid=a.avoidanceCount?a.avoidanceSuccessRate:.65;
    const line=a.racingLineEfficiency||0;
    const inside=a.insideLineAccuracy||0;
    const over=Math.min(1,(a.overtakes||0)/6);
    const lead=Math.min(1,(a.leaderMs||0)/12000);
    const clean=(p.match?.collisions||0)===0?1:0;
    return Math.max(4,Math.min(10,4+6*(
      rankScore*.31+finish*.16+avoid*.18+line*.12+inside*.08+over*.06+lead*.05+clean*.04
    )));
  }

  function styleProfile749(p){
    const a=advancedStats697(p)||{}, c=a.actionCounts||{};
    const attempts=Math.max(1,a.avoidanceCount||0);
    const thread=(c.side||0)+(c.thread||0)+(c.diag||0);
    const back=c.backcon||0;
    const labels=[];
    if(a.insideLineAccuracy>=.94)labels.push("인코스 정밀형");
    if(a.avoidanceSuccessRate>=.82&&a.avoidanceCount>=2)labels.push("회피 특화");
    if(thread/attempts>=.55)labels.push("대각선 돌파형");
    if(back/attempts>=.20)labels.push("빽컨 대응형");
    if((a.leaderMs||0)>7000)labels.push("선두 장악형");
    if((a.overtakes||0)>=4)labels.push("추월 공격형");
    if((p.match?.collisions||0)===0)labels.push("안정형");
    return labels.slice(0,3);
  }

  function playerAnalytics749(p){
    const a=advancedStats697(p)||{};
    const sectors=a.sectors||[];
    const valid=sectors.filter(s=>s.timeMs>0);
    const strongest=valid.length?[...valid].sort((x,y)=>
      (x.avgLineDeviation-y.avgLineDeviation)||(x.timeMs-y.timeMs))[0]:null;
    const weakest=valid.length?[...valid].sort((x,y)=>
      (y.threats-y.evades)-(x.threats-x.evades) || y.avgLineDeviation-x.avgLineDeviation)[0]:null;
    const personality759=personalitySummary759(p);
    return {
      name:p.name,stats:{...p.stats},advanced:a,
      styles:styleProfile749(p),
      personality759,
      strongestSector:strongest?.name||null,weakestSector:weakest?.name||null
    };
  }

  function stabilityAudit698(p,now){
    sanitizeRaceState666(p);
    if(!p||p.dead||p.done) return;

    if(!p._stable698) p._stable698={x:p.x,y:p.y,at:now,stallSince:0};
    const st=p._stable698;
    const moved=Math.hypot(p.x-st.x,p.y-st.y);
    if(moved>.08){
      st.x=p.x;st.y=p.y;st.at=now;st.stallSince=0;
      return;
    }
    if(now-st.at<650) return;
    if(!st.stallSince) st.stallSince=now;

    // Only repair endpoint deadlocks; never teleport a normally slow racer.
    const si=Math.max(0,Math.min(segs.length-1,p.seg||0)),s=segs[si];
    if(!s) return;
    const de=Math.hypot(p.x-s.b[0],p.y-s.b[1]);
    if(de<2.0 && si<segs.length-1 && now-st.stallSince>180){
      p.seg=Math.min(segs.length-1,si+1);
      p._steer617={x:p.x,y:p.y};
      p.mouseTargetX=p.x;p.mouseTargetY=p.y;
      st.x=p.x;st.y=p.y;st.at=now;st.stallSince=0;
    }
    if(si===segs.length-1){
      const fin=route[route.length-1];
      p.mouseTargetX=fin[0];p.mouseTargetY=fin[1];
    }
  }


  // ============================================================
  // v7.09 Race Engine 10.0 FINAL (v7.00 ~ v7.09)
  // Single authoritative calm-racing geometry layer.
  // Observer survival / Racecraft remain higher-priority tactical systems.
  // ============================================================

  // v7.00: authoritative core registry. Old helpers stay available for compatibility,
  // but final calm movement is resolved only through raceEngine1000.
  const RACE_CORE_700={
    engine:"RaceEngine10", geometry:"SMapGeometry3", line:"RacingLine6",
    transition:"SegmentTransition3", boundary:"RoadBoundary3"
  };

  // v7.02: actual corrected S-map corner geometry.
  const CORNERS702=[
    {x:128,y:132.8,inSeg:3,outSeg:4,half:8.45},
    {x:128,y:74,inSeg:7,outSeg:8,half:8.35},
    {x:44,y:74,inSeg:12,outSeg:13,half:7.55},
    {x:44,y:23.5,inSeg:16,outSeg:17,half:7.55}
  ];


  // ============================================================
  // v7.10 GLOBAL OPTIMAL RACING LINE REBUILD
  // Normal racing has ONE shared mathematical line for all 8 racers.
  // Driver identity may affect tiny execution precision only; it may not choose
  // a different macro/micro lane. Avoidance and racecraft are the only exceptions.
  // ============================================================

  const S_MAP_GLOBAL_OPTIMAL_LINE_770=[
    // v7.19 HOTFIX2: fine-grid A* + visibility-string-pulled shortest path
    // through the current actual visible road mask.
    [31.05,132.55],
    [119.05,123.20],
    [119.00,83.20],
    [51.80,64.80],
    [51.80,32.40],
    [52.00,32.20],
    [143.00,23.50]
  ];

  let GLOBAL_OPTIMAL_LINE_710=S_MAP_GLOBAL_OPTIMAL_LINE_770;
  let GLOBAL_OPTIMAL_SEGS_710=[];
  function rebuildGlobalOptimal770(){
    const a=[];let total=0;
    for(let i=0;i<GLOBAL_OPTIMAL_LINE_710.length-1;i++){
      const p=GLOBAL_OPTIMAL_LINE_710[i],q=GLOBAL_OPTIMAL_LINE_710[i+1];
      const dx=q[0]-p[0],dy=q[1]-p[1],L=Math.hypot(dx,dy)||1;
      a.push({a:p,b:q,dx,dy,L,ux:dx/L,uy:dy/L,start:total});
      total+=L;
    }
    a.total=total;GLOBAL_OPTIMAL_SEGS_710=a;
  }
  rebuildGlobalOptimal770();




  // ============================================================
  // v7.19 Observer System 5.0 FINAL (v7.11 ~ v7.19)
  // Fastest line is absolute. Only a real observer collision threat may leave it.
  // ============================================================

  // v7.11 Observer movement audit: normalized per-observer state used by prediction.
  function observerMovementAudit711(o){
    if(!o) return null;
    if(!Number.isFinite(o.vx))o.vx=0;
    if(!Number.isFinite(o.vy))o.vy=0;
    if(!Number.isFinite(o.speed)||o.speed<=0)o.speed=9.72*OBS_SPEED_RATIO;
    if(!o.pattern712)o.pattern712=["free","sweep","diagonal","cross"][Math.abs(o.id||0)%4];
    return o;
  }

  // v7.12 Pattern Diversity. Patterns only change observer motion, never racer route choice.
  function pickObserverLeg712(o){
    observerMovementAudit711(o);
    if(o.pattern712==="free"){
      pickObserverLeg(o);
      return;
    }
    const legSeconds=OBS_MOVE_MS/1000,dist=o.speed*legSeconds,margin=3.5;
    let angles;
    if(o.pattern712==="sweep") angles=[0,Math.PI,Math.PI/2,-Math.PI/2];
    else if(o.pattern712==="diagonal") angles=[Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4];
    else angles=[0,Math.PI/2,Math.PI,-Math.PI/2,Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4];

    const shift=Math.abs((o.id||0)*3)%angles.length;
    angles=angles.slice(shift).concat(angles.slice(0,shift));
    for(const a of angles){
      const ex=o.x+Math.cos(a)*dist,ey=o.y+Math.sin(a)*dist;
      if(ex>=margin&&ex<=MAP_W-margin&&ey>=margin&&ey<=MAP_H-margin){
        o.vx=Math.cos(a)*o.speed;o.vy=Math.sin(a)*o.speed;return;
      }
    }
    pickObserverLeg(o);
  }

  
  // v7.24 removed dead legacy AI: observerSystem519


  // Final v7.19 driving authority:
  // other racers NEVER cause a detour because racers are non-solid.
  // Only observer collision danger may override the fastest shared inside line.

  // ============================================================
  // v7.19 HOTFIX1 — TRUE SHORTEST PATH AUTHORITY
  // ============================================================

  const SHORTEST_PATH_LENGTH_719=322.26665621567776;

  // Actual road legality only. IMPORTANT: ignores obsolete FORBIDDEN96 planning
  // rectangles. Those boxes are not physical road and were forcing visible detours.
  function actualRoadChord719(x0,y0,x1,y1){
    const dist=Math.hypot(x1-x0,y1-y0);
    const n=Math.max(3,Math.ceil(dist/.22));
    for(let i=1;i<=n;i++){
      const t=i/n,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t;
      if(!courseContainsPoint(x,y,0.00) || !visualRoadMask674(x,y,0)) return false;
    }
    return true;
  }

  function actualRoadTarget719(p,si,t){
    if(!t)return null;
    // v7.891: a visual edge line is pass-through, so this legacy road/chord
    // validator must never shrink the target to zero at the boundary.
    if(currentMap770().edgePassThrough786) return t;
    if(courseContainsPoint(t.x,t.y,0.00) &&
       visualRoadMask674(t.x,t.y,si) &&
       actualRoadChord719(p.x,p.y,t.x,t.y)) return t;

    for(let k=30;k>=1;k--){
      const q=k/31;
      const x=p.x+(t.x-p.x)*q,y=p.y+(t.y-p.y)*q;
      if(courseContainsPoint(x,y,0.00) &&
         visualRoadMask674(x,y,si) &&
         actualRoadChord719(p.x,p.y,x,y))
        return {...t,x,y,kind:(t.kind||"target")+"-actual719"};
    }
    return null;
  }

  // The shortest path turns before legacy centerline endpoints. Keep the old
  // segment index synchronized to macro-corner crossings so old telemetry/finish
  // code never traps the racer on the previous straight.


  // ============================================================
  // v7.20 FINAL DRIVING AI — Optimal Racing Spline + 3-State Survival
  // NORMAL -> EVADE -> REJOIN
  // This is the intended final AI layer before FM stats/team/league work.
  // ============================================================

  const S_MAP_RACING_SPLINE_770=[
    [31.05000,132.55000],
    [117.50868,123.36377],
    [117.60039,123.38517],
    [117.68959,123.40411],
    [117.77628,123.42060],
    [117.86045,123.43464],
    [117.94210,123.44622],
    [118.02124,123.45535],
    [118.09785,123.46203],
    [118.17194,123.46626],
    [118.24351,123.46805],
    [118.31255,123.46739],
    [118.37906,123.46429],
    [118.44305,123.45875],
    [118.50450,123.45078],
    [118.56343,123.44036],
    [118.61981,123.42752],
    [118.67367,123.41224],
    [118.72498,123.39452],
    [118.77376,123.37439],
    [118.81999,123.35182],
    [118.86368,123.32683],
    [118.90483,123.29941],
    [118.94343,123.26958],
    [118.97949,123.23732],
    [119.01300,123.20265],
    [119.04395,123.16556],
    [119.07235,123.12605],
    [119.09820,123.08414],
    [119.12150,123.03981],
    [119.14223,122.99308],
    [119.16041,122.94394],
    [119.17602,122.89239],
    [119.18908,122.83844],
    [119.19956,122.78209],
    [119.20749,122.72334],
    [119.21284,122.66220],
    [119.21563,122.59866],
    [119.21584,122.53272],
    [119.21349,122.46440],
    [119.20856,122.39368],
    [119.20105,122.32058],
    [119.19096,122.24509],
    [119.17830,122.16721],
    [119.16306,122.08696],
    [119.14523,122.00432],
    [119.12482,121.91930],
    [119.10182,121.83191],
    [119.07624,121.74214],
    [119.04806,121.65000],
    [119.00194,84.75000],
    [119.02976,84.65797],
    [119.05504,84.56808],
    [119.07779,84.48035],
    [119.09800,84.39477],
    [119.11569,84.31135],
    [119.13084,84.23008],
    [119.14347,84.15098],
    [119.15357,84.07403],
    [119.16114,83.99925],
    [119.16619,83.92664],
    [119.16872,83.85619],
    [119.16873,83.78791],
    [119.16622,83.72181],
    [119.16119,83.65788],
    [119.15365,83.59613],
    [119.14359,83.53655],
    [119.13103,83.47916],
    [119.11595,83.42395],
    [119.09836,83.37092],
    [119.07827,83.32008],
    [119.05567,83.27143],
    [119.03056,83.22497],
    [119.00296,83.18071],
    [118.97285,83.13864],
    [118.94025,83.09877],
    [118.90514,83.06110],
    [118.86755,83.02563],
    [118.82745,82.99236],
    [118.78487,82.96130],
    [118.73979,82.93245],
    [118.69223,82.90581],
    [118.64217,82.88138],
    [118.58964,82.85917],
    [118.53461,82.83918],
    [118.47711,82.82140],
    [118.41712,82.80584],
    [118.35465,82.79251],
    [118.28971,82.78140],
    [118.22229,82.77252],
    [118.15239,82.76588],
    [118.08002,82.76146],
    [118.00518,82.75927],
    [117.92787,82.75932],
    [117.84810,82.76161],
    [117.76585,82.76614],
    [117.68114,82.77292],
    [117.59397,82.78193],
    [117.50434,82.79320],
    [55.20000,65.84715],
    [55.13371,65.82946],
    [55.06753,65.81246],
    [55.00146,65.79612],
    [54.93553,65.78039],
    [54.86975,65.76526],
    [54.80412,65.75068],
    [54.73866,65.73662],
    [54.67338,65.72305],
    [54.60829,65.70994],
    [54.54342,65.69725],
    [54.47876,65.68495],
    [54.41433,65.67300],
    [54.35015,65.66138],
    [54.28622,65.65005],
    [54.22256,65.63898],
    [54.15919,65.62813],
    [54.09610,65.61747],
    [54.03333,65.60697],
    [53.97087,65.59659],
    [53.90874,65.58631],
    [53.84696,65.57608],
    [53.78553,65.56588],
    [53.72447,65.55567],
    [53.66379,65.54541],
    [53.60350,65.53509],
    [53.54362,65.52465],
    [53.48415,65.51408],
    [53.42512,65.50333],
    [53.36653,65.49238],
    [53.30839,65.48118],
    [53.25072,65.46971],
    [53.19354,65.45794],
    [53.13684,65.44582],
    [53.08065,65.43333],
    [53.02497,65.42044],
    [52.96983,65.40711],
    [52.91523,65.39330],
    [52.86118,65.37899],
    [52.80770,65.36414],
    [52.75479,65.34872],
    [52.70248,65.33270],
    [52.65078,65.31603],
    [52.59969,65.29870],
    [52.54923,65.28066],
    [52.49941,65.26189],
    [52.45024,65.24234],
    [52.40174,65.22199],
    [52.35392,65.20080],
    [52.30679,65.17875],
    [52.26036,65.15579],
    [52.21465,65.13189],
    [52.16967,65.10702],
    [52.12543,65.08115],
    [52.08194,65.05425],
    [52.03922,65.02628],
    [51.99727,64.99720],
    [51.95612,64.96699],
    [51.91577,64.93561],
    [51.87623,64.90303],
    [51.83752,64.86922],
    [51.79965,64.83414],
    [51.76264,64.79775],
    [51.72649,64.76004],
    [51.69121,64.72095],
    [51.65683,64.68047],
    [51.62335,64.63855],
    [51.59078,64.59516],
    [51.55914,64.55028],
    [51.52844,64.50386],
    [51.49869,64.45588],
    [51.46990,64.40629],
    [51.44210,64.35508],
    [51.41528,64.30220],
    [51.38946,64.24762],
    [51.36466,64.19130],
    [51.34088,64.13323],
    [51.31814,64.07335],
    [51.29645,64.01165],
    [51.27583,63.94808],
    [51.25628,63.88261],
    [51.23782,63.81521],
    [51.22046,63.74585],
    [51.20422,63.67449],
    [51.18910,63.60110],
    [51.17512,63.52564],
    [51.16229,63.44809],
    [51.15062,63.36842],
    [51.14013,63.28657],
    [51.13083,63.20254],
    [51.12272,63.11627],
    [51.11583,63.02774],
    [51.11017,62.93691],
    [51.10574,62.84376],
    [51.10256,62.74825],
    [51.10064,62.65034],
    [51.10000,62.55000],
    [51.10000,34.65000],
    [51.10002,34.60482],
    [51.10007,34.55990],
    [51.10016,34.51525],
    [51.10030,34.47088],
    [51.10048,34.42678],
    [51.10071,34.38297],
    [51.10099,34.33944],
    [51.10133,34.29621],
    [51.10173,34.25327],
    [51.10219,34.21063],
    [51.10272,34.16830],
    [51.10332,34.12627],
    [51.10399,34.08456],
    [51.10474,34.04316],
    [51.10557,34.00209],
    [51.10648,33.96134],
    [51.10748,33.92093],
    [51.10857,33.88085],
    [51.10975,33.84111],
    [51.11103,33.80171],
    [51.11241,33.76266],
    [51.11390,33.72397],
    [51.11549,33.68563],
    [51.11719,33.64766],
    [51.11900,33.61005],
    [51.12094,33.57281],
    [51.12299,33.53595],
    [51.12517,33.49946],
    [51.12747,33.46336],
    [51.12991,33.42765],
    [51.13248,33.39233],
    [51.13519,33.35741],
    [51.13803,33.32289],
    [51.14103,33.28877],
    [51.14417,33.25507],
    [51.14746,33.22178],
    [51.15091,33.18891],
    [51.15451,33.15646],
    [51.15828,33.12444],
    [51.16221,33.09285],
    [51.16631,33.06170],
    [51.17058,33.03099],
    [51.17503,33.00073],
    [51.17965,32.97092],
    [51.18446,32.94156],
    [51.18945,32.91266],
    [51.19463,32.88422],
    [51.20000,32.85625],
    [51.20557,32.82875],
    [51.21133,32.80173],
    [51.21730,32.77519],
    [51.22347,32.74914],
    [51.22986,32.72357],
    [51.23645,32.69850],
    [51.24326,32.67393],
    [51.25029,32.64986],
    [51.25754,32.62629],
    [51.26502,32.60324],
    [51.27272,32.58071],
    [51.28066,32.55869],
    [51.28884,32.53720],
    [51.29725,32.51624],
    [51.30591,32.49581],
    [51.31481,32.47593],
    [51.32397,32.45658],
    [51.33337,32.43778],
    [51.34304,32.41953],
    [51.35296,32.40184],
    [51.36314,32.38471],
    [51.37360,32.36814],
    [51.38432,32.35214],
    [51.39531,32.33672],
    [51.40658,32.32187],
    [51.41814,32.30761],
    [51.42997,32.29393],
    [51.44209,32.28084],
    [51.45451,32.26835],
    [51.46721,32.25646],
    [51.48022,32.24517],
    [51.49352,32.23449],
    [51.50713,32.22442],
    [51.52104,32.21498],
    [51.53527,32.20615],
    [51.54980,32.19795],
    [51.56466,32.19038],
    [51.57984,32.18345],
    [51.59534,32.17715],
    [51.61117,32.17150],
    [51.62733,32.16650],
    [51.64382,32.16215],
    [51.66066,32.15845],
    [51.67783,32.15542],
    [51.69535,32.15306],
    [51.71321,32.15136],
    [51.73143,32.15034],
    [51.75000,32.15000],
    [51.78912,32.14991],
    [51.82835,32.14966],
    [51.86770,32.14923],
    [51.90717,32.14864],
    [51.94679,32.14788],
    [51.98655,32.14696],
    [52.02645,32.14588],
    [52.06652,32.14464],
    [52.10675,32.14324],
    [52.14716,32.14169],
    [52.18775,32.13998],
    [52.22852,32.13812],
    [52.26949,32.13611],
    [52.31067,32.13395],
    [52.35206,32.13165],
    [52.39366,32.12920],
    [52.43550,32.12661],
    [52.47756,32.12388],
    [52.51987,32.12101],
    [52.56243,32.11800],
    [52.60524,32.11485],
    [52.64832,32.11158],
    [52.69166,32.10817],
    [52.73529,32.10463],
    [52.77921,32.10097],
    [52.82342,32.09717],
    [52.86793,32.09326],
    [52.91275,32.08922],
    [52.95789,32.08506],
    [53.00335,32.08079],
    [53.04914,32.07639],
    [53.09528,32.07189],
    [53.14176,32.06727],
    [53.18860,32.06253],
    [53.23579,32.05769],
    [53.28336,32.05275],
    [53.33131,32.04769],
    [53.37964,32.04254],
    [53.42836,32.03728],
    [53.47748,32.03192],
    [53.52702,32.02646],
    [53.57696,32.02091],
    [53.62733,32.01526],
    [53.67813,32.00952],
    [53.72937,32.00370],
    [53.78105,31.99778],
    [53.83319,31.99177],
    [53.88578,31.98568],
    [53.93885,31.97951],
    [53.99238,31.97326],
    [54.04641,31.96692],
    [54.10092,31.96051],
    [54.15593,31.95403],
    [54.21145,31.94747],
    [54.26748,31.94083],
    [54.32403,31.93413],
    [54.38111,31.92736],
    [54.43873,31.92052],
    [54.49689,31.91362],
    [54.55560,31.90666],
    [54.61487,31.89964],
    [54.67471,31.89255],
    [54.73512,31.88541],
    [54.79611,31.87822],
    [54.85769,31.87097],
    [54.91987,31.86367],
    [54.98265,31.85632],
    [55.04604,31.84892],
    [55.11005,31.84148],
    [55.17469,31.83399],
    [55.23996,31.82646],
    [55.30588,31.81889],
    [55.37244,31.81129],
    [55.43966,31.80364],
    [55.50755,31.79596],
    [55.57611,31.78825],
    [55.64534,31.78051],
    [55.71527,31.77274],
    [55.78588,31.76494],
    [55.85720,31.75711],
    [55.92924,31.74927],
    [56.00198,31.74140],
    [56.07546,31.73351],
    [56.14966,31.72560],
    [56.22461,31.71768],
    [56.30030,31.70974],
    [56.37675,31.70179],
    [56.45396,31.69383],
    [56.53194,31.68586],
    [56.61069,31.67789],
    [56.69024,31.66991],
    [56.77057,31.66192],
    [56.85171,31.65394],
    [56.93366,31.64596],
    [57.01642,31.63798],
    [57.10000,31.63000],
    [143.00000,23.50000]
  ];

  let RACING_SPLINE_720=S_MAP_RACING_SPLINE_770;
  let RACING_SPLINE_SEGS_720=[];
  let RACING_SPLINE_LENGTH_720=0;
  function rebuildRacingSpline770(){
    const out=[];let total=0;
    for(let i=0;i<RACING_SPLINE_720.length-1;i++){
      const a=RACING_SPLINE_720[i],b=RACING_SPLINE_720[i+1];
      const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;
      out.push({a,b,dx,dy,L,ux:dx/L,uy:dy/L,start:total});
      total+=L;
    }
    out.total=total;RACING_SPLINE_SEGS_720=out;RACING_SPLINE_LENGTH_720=total;
  }
  rebuildRacingSpline770();

  function bindSMapGeometry770(){
    const m=MAP_DEFINITIONS_770.s_map;
    m.route770=S_MAP_ROUTE_770;
    m.widths770=S_MAP_WIDTHS_770;
    m.globalOptimal770=S_MAP_GLOBAL_OPTIMAL_LINE_770;
    m.racingSpline770=S_MAP_RACING_SPLINE_770;
    m.roadMask770=sMapVisualRoadMask770;
    m.forbiddenZones770=S_MAP_FORBIDDEN_770;
    m.geometryReady=true;
  }
  bindSMapGeometry770();

  // ============================================================
  // v7.72 RACING LINE GENERATOR
  // Builds a deterministic smooth/inside legal line from each approved road geometry.
  // No shortcut is invented: every chord and apex candidate must remain inside the
  // map's own road corridor. S-map keeps its battle-tested hand-tuned spline.
  // ============================================================
  function mapLineInside772(m,a,b,margin=-.18){
    const d=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const n=Math.max(2,Math.ceil(d/.42));
    for(let i=0;i<=n;i++){
      const t=i/n,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
      if(!genericCourseMask771(m,x,y,margin))return false;
    }
    return true;
  }
  function densifyLine772(points,step=1.35){
    if(!points||points.length<2)return points||[];
    const out=[[points[0][0],points[0][1]]];
    for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1],d=Math.hypot(b[0]-a[0],b[1]-a[1]);
      const n=Math.max(1,Math.ceil(d/step));
      for(let k=1;k<=n;k++){const t=k/n;out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
    }
    return out;
  }
  function smoothLegalLine772(m,points,passes=3){
    let p=points.map(q=>[q[0],q[1]]);
    for(let pass=0;pass<passes;pass++){
      const n=p.map(q=>[q[0],q[1]]);
      for(let i=1;i<p.length-1;i++){
        const a=p[i-1],q=p[i],b=p[i+1];
        const c=[a[0]*.22+q[0]*.56+b[0]*.22,a[1]*.22+q[1]*.56+b[1]*.22];
        if(genericCourseMask771(m,c[0],c[1],-.22)&&mapLineInside772(m,a,c)&&mapLineInside772(m,c,b))n[i]=c;
      }
      p=n;
    }
    return p;
  }
  function apexPass772(m,points){
    const p=points.map(q=>[q[0],q[1]]),baseW=Number(m.widths770?.[0]||10);
    for(let i=3;i<p.length-3;i+=2){
      const a=p[i-3],q=p[i],b=p[i+3];
      let ax=q[0]-a[0],ay=q[1]-a[1],bx=b[0]-q[0],by=b[1]-q[1];
      let al=Math.hypot(ax,ay)||1,bl=Math.hypot(bx,by)||1;ax/=al;ay/=al;bx/=bl;by/=bl;
      const cross=ax*by-ay*bx,turn=Math.min(1,Math.abs(cross)*1.55);
      if(turn<.08)continue;
      let tx=ax+bx,ty=ay+by,tl=Math.hypot(tx,ty)||1;tx/=tl;ty/=tl;
      let nx=-ty,ny=tx;if(cross<0){nx=-nx;ny=-ny;}
      const off=Math.min(1.18,baseW*.12)*turn,c=[q[0]+nx*off,q[1]+ny*off];
      if(genericCourseMask771(m,c[0],c[1],-.30)&&mapLineInside772(m,p[i-1],c,-.24)&&mapLineInside772(m,c,p[i+1],-.24))p[i]=c;
    }
    return p;
  }
  function stringPull772(m,points){
    const out=[],maxChord=11.5;let i=0;out.push(points[0]);
    while(i<points.length-1){
      let best=i+1;
      for(let j=i+2;j<Math.min(points.length,i+11);j++){
        if(Math.hypot(points[j][0]-points[i][0],points[j][1]-points[i][1])>maxChord)break;
        if(mapLineInside772(m,points[i],points[j],-.25))best=j;else break;
      }
      i=best;out.push(points[i]);
    }
    return out;
  }
  function generateRacingLine772(m){
    let p=densifyLine772(m.route770||[],1.35);
    p=smoothLegalLine772(m,p,3);
    p=apexPass772(m,p);
    p=stringPull772(m,p);
    p=densifyLine772(p,.92);
    p=smoothLegalLine772(m,p,2);
    if(p.length<3)return (m.route770||[]).map(q=>[q[0],q[1]]);
    p[0]=[m.route770[0][0],m.route770[0][1]];
    p[p.length-1]=[m.route770[m.route770.length-1][0],m.route770[m.route770.length-1][1]];
    return p;
  }

  // v7.90: obsolete v7.71 geometry bootstrap removed; active 9-map geometry is applied by later final patches.




// ============================================================
// v7.76 MAP PACK REFRESH — 9 MAP CURATION
// Keep Neon Drift + Star Fish and refresh the rest of the visible map pool.
// Geometry stays on the closest existing playable layouts; this patch focuses
// on the in-game map roster, names, thumbnails, and artwork replacement.
// ============================================================
function applyMapSet776(){
  const keep=["s_map","star_fish","ice_ring","desert_oasis","neon_city","double_hairpin","skyway","cliff_hanger","triple_diamond"];
  const meta={
    s_map:{slot:1,name:"네온 드리프트",en:"Neon Drift",theme:"Blue Neon S Course",tags:["기본","S자","네온"],image:"map_v672_equal_medium_start_goal.png?v=776-neon-drift"},
    star_fish:{slot:2,name:"스타 피쉬",en:"Star Fish",theme:"Tropical Star Island",tags:["기본","별모양","한바퀴"],image:"map_star_fish_791.png?v=803-theme-tile"},
    ice_ring:{slot:3,name:"아이스 크라운",en:"Ice Crown",theme:"Frozen Crown Canyon",tags:["기본","M자","아이스"],image:"map_ice_m_787.png?v=793-ice-crown-clean",special:{shortcuts:false,obstacles:false,wideRoad:false,multiRoute:false,verticality:false}},
    desert_oasis:{slot:4,name:"사막 오아시스",en:"Desert Oasis",theme:"Desert Ruins Oasis",tags:["기본","사막","한바퀴"],image:"map_desert_oasis_899.png?v=803-theme-tile",special:{shortcuts:false,obstacles:false,wideRoad:true,multiRoute:false,verticality:false}},
    neon_city:{slot:5,name:"하트",en:"Heart",theme:"Cherry Blossom Heart",tags:["기본","하트","한바퀴"],image:"map_heart_7891_clean.png?v=803-theme-tile",special:{shortcuts:false,obstacles:false,wideRoad:true,multiRoute:false,verticality:false}},
    double_hairpin:{slot:6,name:"세잎 클로버",en:"Three-Leaf Clover",theme:"Tropical Clover Circuit",tags:["세잎클로버","우측루프","반시계"],image:"map_clover_164.png?v=1640",special:{shortcuts:false,obstacles:false,wideRoad:false,multiRoute:false,verticality:false}},
    skyway:{slot:7,name:"스페이스",en:"Space",theme:"Deep Space Narrow Run",tags:["좁은길","직선","우주"],image:"map_space_894.png?v=803-theme-tile",special:{shortcuts:false,obstacles:false,wideRoad:false,multiRoute:false,verticality:true}},
    cliff_hanger:{slot:8,name:"스카이 클리프",en:"Sky Cliff",theme:"Frozen Cliff Run",tags:["좁은길","절벽","정밀"],image:"map_cliff_hanger_899.png?v=803-theme-tile",special:{shortcuts:false,obstacles:false,wideRoad:false,multiRoute:false,verticality:true}},
    triple_diamond:{slot:9,name:"데스티니 게이트",en:"Destiny Gate",theme:"Heaven vs Hell Destiny Gate",tags:["데스티니게이트","2스타트","천국vs지옥"],image:"map_destiny_gate_8113.png?v=817-destiny-gate",special:{shortcuts:false,obstacles:false,wideRoad:true,multiRoute:true,verticality:false}}
  };
  for(const id of keep){
    const m=MAP_DEFINITIONS_770[id];
    if(!m)continue;
    Object.assign(m,meta[id]);
  }
  MAP_POOL_770.splice(0,MAP_POOL_770.length,...keep.map(id=>MAP_DEFINITIONS_770[id]));
  if(!keep.includes(activeMapId770)){
    // v1.63.0: do not silently switch a broken/unknown map to ObserverS.
    // Keep the current object untouched so the caller can surface the real map-id error.
    console.error("[v1.64.0] active map id is outside the canonical roster:",activeMapId770);
  }
}
applyMapSet776();

  const CIRCUIT_MAPS_775=new Set(["star_fish","desert_oasis","neon_city"]);
  const POINT_TO_POINT_MAPS_775=new Set(["ice_ring","double_hairpin","skyway","cliff_hanger","triple_diamond"]);
  // v7.90: obsolete v7.75 start/finish conversion removed; final geometry patches below are authoritative.



  // ============================================================
  // v7.77 PER-MAP ROAD GEOMETRY / START-FINISH / MINIMAP QA
  // Routes below are traced against the actual v7.76 map artwork.
  // ============================================================
  function applyGeometry777(){
    const set777=(id,data)=>{
      const m=MAP_DEFINITIONS_770[id];
      if(!m)return;
      Object.assign(m,data);
      m.extraRoads771=[];m.forbiddenZones770=[];m.geometryReady=true;m.approvedImageShape772=true;
      const line=generateRacingLine772(m);
      m.racingSpline770=line;
      m.globalOptimal770=line;
    };
    set777("star_fish",{
      image:"map_star_fish_791.png?v=803-theme-tile",imageSize:{w:1254,h:1254},
      logicalSize:{w:172,h:172},
      route770:[[86.0,28.6],[101.322,45.0],[132.213,48.2],[147.04,61.9],[130.977,77.8],[122.328,100.0],[101.322,95.1],[86.0,111.8],[70.678,95.1],[49.92,100.0],[40.776,77.8],[24.218,61.9],[40.034,48.2],[70.678,45.0],[86.0,28.6]],widths770:[7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6],
      start:{x:86.0,y:28.6},goal:{x:86.0,y:28.6},
      safeZones:{"start":{"x0":79.8,"y0":24.1,"x1":92.2,"y1":33.1},"goal":{"x0":79.8,"y0":24.1,"x1":92.2,"y1":33.1}},miniCrop:{x:10,y:10,w:152,h:146},
      courseType775:"circuit",finishRule775:"one-lap-gate",lapRequired775:true,
      lapArmFraction775:.82,racingLineMode772:"generated-v7.791"
    });
    set777("ice_ring",{
      image:"map_ice_m_787.png?v=792-geometry",imageSize:{w:1122,h:1402},
      logicalSize:{w:142.451,h:178},
      route770:[[20.377,138.642],[20.314,126.0],[20.314,112.0],[20.314,98.0],[20.314,84.0],[20.314,70.0],[20.55,56.0],[21.3,44.0],[23.4,33.2],[27.6,25.5],[33.6,22.4],[40.2,22.0],[45.5,24.8],[49.1,31.0],[53.0,39.8],[57.5,49.8],[62.3,59.5],[67.0,67.1],[71.099,69.194],[75.2,67.1],[79.9,59.5],[84.7,49.8],[89.2,39.8],[93.1,31.0],[96.7,24.8],[102.0,22.0],[108.6,22.4],[114.6,25.5],[118.8,33.2],[120.9,44.0],[121.65,56.0],[121.95,70.0],[121.95,84.0],[121.95,98.0],[121.946,112.0],[121.946,126.0],[121.946,138.642]],widths770:[16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0],
      start:{x:20.377,y:138.642},goal:{x:121.946,y:138.642},
      safeZones:{"start":{"x0":13.966,"y0":132.294,"x1":26.789,"y1":144.99},"goal":{"x0":115.535,"y0":132.294,"x1":128.358,"y1":144.99}},miniCrop:{x:0,y:0,w:142.451,h:178},
      courseType775:"point-to-point",finishRule775:"end-gate",lapRequired775:false,
      lapArmFraction775:0,racingLineMode772:"generated-v7.792"
    });
    set777("desert_oasis",{
      image:"map_desert_oasis_899.png?v=803-theme-tile",imageSize:{w:1122,h:1402},
      logicalSize:{w:142.451,h:178},
      route770:[[18.409,60.942],[17.775,82.525],[19.044,105.378],[29.836,130.77],[54.594,138.388],[82.525,138.388],[106.648,132.04],[118.074,114.265],[121.248,88.873],[121.248,63.481],[116.805,41.897],[101.569,26.662],[78.716,21.583],[59.672,26.662],[45.706,36.184],[27.932,38.088],[20.314,45.071],[18.409,60.942]],widths770:[17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0],
      start:{x:18.409,y:60.942},goal:{x:18.409,y:60.942},
      safeZones:{"start":{"x0":12.908999999999999,"y0":55.442,"x1":23.909,"y1":66.44200000000001},"goal":{"x0":12.908999999999999,"y0":55.442,"x1":23.909,"y1":66.44200000000001}},miniCrop:{x:0,y:0,w:142.451,h:178},
      courseType775:"circuit",finishRule775:"one-lap-gate",lapRequired775:true,
      lapArmFraction775:.82,racingLineMode772:"generated-v7.77"
    });
    set777("neon_city",{
      image:"map_heart_7891_clean.png?v=803-theme-tile",imageSize:{w:1122,h:1402},
      logicalSize:{w:142.451,h:178},
      route770:[[71.099,131.405],[57.133,119.979],[43.167,107.917],[31.106,93.317],[23.488,76.177],[22.853,54.593],[29.836,38.088],[43.167,29.201],[57.133,31.106],[71.099,43.802],[85.064,31.106],[99.03,29.201],[112.361,38.088],[119.344,54.593],[118.709,76.177],[111.091,93.317],[99.03,107.917],[85.064,119.979],[71.099,131.405]],widths770:[16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5],
      start:{x:71.099,y:131.405},goal:{x:71.099,y:131.405},
      safeZones:{"start":{"x0":65.599,"y0":125.905,"x1":76.599,"y1":136.905},"goal":{"x0":65.599,"y0":125.905,"x1":76.599,"y1":136.905}},miniCrop:{x:0,y:0,w:142.451,h:178},
      courseType775:"circuit",finishRule775:"one-lap-gate",lapRequired775:true,
      lapArmFraction775:.82,racingLineMode772:"generated-v7.77"
    });
    set777("double_hairpin",{
      image:"map_clover_164.png?v=1640",imageSize:{w:1122,h:1402},
      logicalSize:{w:142.451,h:178},
      route770:[[32.721,128.013],[25.467,120.68],[19.564,112.346],[15.142,103.251],[12.292,93.653],[11.057,83.819],[11.439,74.017],[13.394,64.507],[16.838,55.537],[21.648,47.337],[27.666,40.108],[34.707,34.024],[42.561,29.223],[50.998,25.806],[59.782,23.834],[68.669,23.328],[77.42,24.268],[85.802,26.597],[93.6,30.222],[100.618,35.014],[106.687,40.818],[111.666,47.454],[115.447,54.725],[117.958,62.421],[119.162,70.323],[119.061,78.216],[117.688,85.886],[115.114,93.134],[111.438,99.775],[106.788,105.647],[101.315,110.611],[95.188,114.559],[88.591,117.411],[81.713,119.12],[74.749,119.673],[67.889,119.086],[61.315,117.409],[55.196,114.718],[49.686,111.116],[44.915,106.728],[40.989,101.696],[37.99,96.178],[35.969,90.337],[34.951,84.343],[34.931,78.363],[35.878,72.561],[37.732,67.088],[40.412,62.084],[43.818,57.667],[47.83,53.939],[52.317,50.977],[57.138,48.836],[62.149,47.542],[67.205,47.101],[72.164,47.492],[76.893,48.671],[81.271,50.575],[85.19,53.121],[88.56,56.213],[91.311,59.74],[93.392,63.586],[94.774,67.63],[95.45,71.748],[95.433,75.82],[94.757,79.735],[93.471,83.389],[91.643,86.69],[89.351,89.561],[86.686,91.943],[83.745,93.791],[80.627,95.083],[77.433,95.81]],widths770:[15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5],
      start:{x:32.721,y:128.013},goal:{x:77.433,y:95.81},
      safeZones:{"start":{"x0":27.220999999999997,"y0":122.513,"x1":38.221,"y1":133.513},"goal":{"x0":71.933,"y0":90.31,"x1":82.933,"y1":101.31}},miniCrop:{x:0,y:0,w:142.451,h:178},
      courseType775:"point-to-point",finishRule775:"end-gate",lapRequired775:false,
      lapArmFraction775:0,racingLineMode772:"generated-v7.77"
    });
    set777("skyway",{
      image:"map_space_894.png?v=803-theme-tile",imageSize:{w:724,h:2172},
      logicalSize:{w:59.333,h:178},
      route770:[[29.666,167.182],[29.666,152.431],[29.666,135.221],[29.666,118.011],[29.666,100.801],[29.666,83.591],[29.666,66.381],[29.666,49.171],[29.666,31.961],[29.666,12.703]],widths770:[5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8],
      start:{x:29.666,y:167.182},goal:{x:29.666,y:12.703},
      safeZones:{"start":{"x0":26.416,"y0":163.932,"x1":32.916,"y1":170.432},"goal":{"x0":26.416,"y0":9.453,"x1":32.916,"y1":15.953}},miniCrop:{x:0,y:0,w:59.333,h:178},
      courseType775:"point-to-point",finishRule775:"end-gate",lapRequired775:false,
      lapArmFraction775:0,racingLineMode772:"generated-v7.77"
    });
    set777("cliff_hanger",{
      image:"map_cliff_hanger_899.png?v=803-theme-tile",imageSize:{w:1086,h:1448},
      logicalSize:{w:133.5,h:178},
      route770:[[27.044,14.137],[36.878,14.137],[47.942,18.439],[57.776,26.43],[68.84,35.035],[84.82,40.566],[102.03,45.483],[116.167,52.859],[121.084,63.923],[120.47,79.903],[117.396,94.655],[110.635,106.948],[100.801,114.323],[88.508,115.552],[79.903,107.562],[70.684,95.884],[61.464,84.82],[51.63,81.133],[41.181,83.591],[31.347,89.738],[25.2,98.343],[25.2,108.177],[30.732,116.167],[39.337,121.084],[40.566,129.075],[36.878,135.221],[42.41,139.523],[54.703,139.523]],widths770:[6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4],
      start:{x:27.044,y:14.137},goal:{x:54.703,y:139.523},
      safeZones:{"start":{"x0":23.794,"y0":10.887,"x1":30.294,"y1":17.387},"goal":{"x0":51.453,"y0":136.273,"x1":57.953,"y1":142.773}},miniCrop:{x:0,y:0,w:133.5,h:178},
      courseType775:"point-to-point",finishRule775:"end-gate",lapRequired775:false,
      lapArmFraction775:0,racingLineMode772:"generated-v7.77"
    });
    set777("triple_diamond",{
      image:"map_destiny_gate_8113.png?v=817-destiny-gate",imageSize:{w:1254,h:1254},
      logicalSize:{w:178,h:178},
      route770:[[89.05,165.8],[72.2,153],[55,138],[74,116],[89.05,107],[123,88],[110,61],[89.05,51],[55,34],[68,14.5],[89.1,5.8]],
      widths770:[7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2],
      start:{x:89.05,y:165.8},goal:{x:89.1,y:5.8},
      safeZones:{start:{x0:67.5,y0:160.5,x1:110.7,y1:171.8},goal:{x0:84.4,y0:1.8,x1:93.8,y1:10.0}},
      miniCrop:{x:0,y:0,w:178,h:178},
      courseType775:"point-to-point",finishRule775:"end-gate",lapRequired775:false,
      lapArmFraction775:0,racingLineMode772:"destiny-bootstrap-v8.12"
    });
    const s=MAP_DEFINITIONS_770.s_map;
    if(s){s.name="네온 드리프트";s.en="Neon Drift";s.courseType775="point-to-point";s.finishRule775="end-gate";s.lapRequired775=false;}
  }
  applyGeometry777();

  // ============================================================
  // v7.78 CORRECTED2 — SHARED RED START/FINISH + HARD LOCAL ROAD FOLLOW
  // Normal driving on new maps follows the traced road. Large apex/string-pull
  // cuts are disabled so nearby parallel road sections cannot be mistaken for
  // a legal macro shortcut. Observer EVADE/REJOIN remains independent.
  // ============================================================
  function conservativeRacingLine778(m){
    // CORRECTED v7.78: do NOT create any new apex/string-pull/smoothing chord.
    // The actual traced route is the authority. Densifying only adds samples on
    // the same physical segments, so a nearby parallel road can never become a
    // normal-racing shortcut.
    let line=densifyLine772(m.route770||[],.36);
    if(line.length<3)line=(m.route770||[]).map(q=>[q[0],q[1]]);
    if(line.length){
      line[0]=[m.route770[0][0],m.route770[0][1]];
      line[line.length-1]=[m.route770[m.route770.length-1][0],m.route770[m.route770.length-1][1]];
    }
    return line;
  }

  function applyRoadFollow778(){
    for(const m of MAP_POOL_770){
      if(m.id==="s_map"){
        m.sharedGate778=false;
        continue;
      }
      const line=conservativeRacingLine778(m);
      m.racingSpline770=line;
      m.globalOptimal770=line;
      m.racingLineMode772="generated-v7.78";
      m.strictRoadFollow778=true;
      m.roadFollowMode778="route-center-hard";

      const sx=(m.safeZones.start.x0+m.safeZones.start.x1)*.5;
      const sy=(m.safeZones.start.y0+m.safeZones.start.y1)*.5;
      const gx=(m.safeZones.goal.x0+m.safeZones.goal.x1)*.5;
      const gy=(m.safeZones.goal.y0+m.safeZones.goal.y1)*.5;
      m.sharedGate778=!!m.lapRequired775 && Math.hypot(sx-gx,sy-gy)<.75;
    }
    // Heart uses a visibly larger common gate as requested.
    const heart=MAP_DEFINITIONS_770.neon_city;
    if(heart?.sharedGate778){
      const c=[heart.start.x,heart.start.y],h=7.0;
      heart.safeZones={
        start:{x0:c[0]-h,y0:c[1]-h,x1:c[0]+h,y1:c[1]+h},
        goal:{x0:c[0]-h,y0:c[1]-h,x1:c[0]+h,y1:c[1]+h}
      };
    }
  }
  applyRoadFollow778();

  // ============================================================
  // v7.792 — ICE CROWN PATCH
  // 1) Rename ICE M -> Ice Crown
  // 2) Align gate rectangles with artwork so the higher duplicate box disappears
  // 3) Use a faster inside-biased top route from 11 o'clock to 1 o'clock
  // 4) Block the non-drivable central upper interior of the M
  // ============================================================
  function applyIceCrownPatch792(){
    const m=MAP_DEFINITIONS_770.ice_ring;
    if(!m)return;
    m.name="아이스 크라운";
    m.en="Ice Crown";
    m.theme="Frozen Crown Canyon";
    m.tags=["기본","M자","아이스"];
    m.forbiddenZones770=[{x1:56.0,y1:6.0,x2:86.0,y2:61.0}];
    const line=conservativeRacingLine778(m);
    m.racingSpline770=line;
    m.globalOptimal770=line;
    m.racingLineMode772="generated-v7.792";
  }
  applyIceCrownPatch792();

  // ============================================================
  // v7.793 — Heart / retired slot 6 course / Space targeted tuning
  // 1) Heart: move shared red gate upward and start slightly higher
  // 2) retired slot 6 course: use only the lower start gate and make the normal line
  //    follow the road with a safer outer bias (avoid over-apex lane hopping)
  // 3) Space: widen the narrow corridor a bit visually + logically
  // ============================================================
  function applyTargetedPatch793(){
    const heart=MAP_DEFINITIONS_770.neon_city;
    if(heart){
      const p=[71.099,126.205];
      heart.start={x:p[0],y:p[1]};
      heart.goal={x:p[0],y:p[1]};
      if(Array.isArray(heart.route770) && heart.route770.length>=2){
        heart.route770[0]=[p[0],p[1]];
        heart.route770[heart.route770.length-1]=[p[0],p[1]];
      }
      const h=7.0;
      heart.safeZones={
        start:{x0:p[0]-h,y0:p[1]-h,x1:p[0]+h,y1:p[1]+h},
        goal:{x0:p[0]-h,y0:p[1]-h,x1:p[0]+h,y1:p[1]+h}
      };
      heart.sharedGate778=true;
      let line=conservativeRacingLine778(heart);
      heart.racingSpline770=line;
      heart.globalOptimal770=line;
      heart.racingLineMode772="generated-v7.793";
    }

    const black=MAP_DEFINITIONS_770.double_hairpin;
    if(black){
      black.route770=[[14.6,145.0],[14.9,136.5],[15.8,128.0],[17.0,120.2],[17.619,113.752],[12.999,104.331],[10.004,94.377],[8.682,84.167],[9.039,73.978],[11.033,64.078],[14.578,54.728],[19.552,46.167],[25.793,38.607],[33.111,32.232],[41.288,27.188],[50.086,23.586],[59.259,21.492],[68.552,20.931],[77.712,21.886],[86.495,24.299],[94.674,28.076],[102.04,33.081],[108.416,39.153],[113.65,46.103],[117.629,53.725],[120.276,61.798],[121.551,70.09],[121.456,78.377],[120.025,86.433],[117.332,94.05],[113.482,101.033],[108.607,107.213],[102.865,112.444],[96.432,116.611],[89.502,119.632],[82.269,121.455],[74.939,122.065],[67.769,120.682],[60.952,118.967],[54.598,116.202],[48.867,112.491],[43.894,107.96],[39.79,102.755],[36.641,97.038],[34.502,90.976],[33.402,84.742],[33.338,78.511],[34.282,72.451],[36.175,66.72],[38.937,61.465],[42.466,56.811],[46.641,52.868],[51.328,49.719],[56.381,47.427],[61.648,46.022],[66.978,45.517],[72.22,45.893],[77.104,47.694],[81.652,49.651],[85.729,52.279],[89.239,55.479],[92.108,59.136],[94.281,63.129],[95.728,67.332],[96.441,71.615],[96.432,75.854],[95.737,79.932],[94.407,83.741],[92.511,87.186],[90.131,90.187],[87.361,92.681],[84.3,94.623],[81.052,95.988],[77.72,96.768]];
      black.widths770=[13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5];
      black.start={x:14.6,y:145.0};
      black.goal={x:77.72,y:96.768};
      black.safeZones={
        start:{x0:9.2,y0:139.6,x1:20.0,y1:150.4},
        goal:{x0:72.72,y0:91.768,x1:82.72,y1:101.768}
      };
      black.strictRoadFollow778=true;
      black.roadFollowMode778="route-center-hard";
      let line=conservativeRacingLine778(black);
      black.racingSpline770=line;
      black.globalOptimal770=line;
      black.racingLineMode772="generated-v7.793";
    }

    const space=MAP_DEFINITIONS_770.skyway;
    if(space){
      space.image="map_space_894.png?v=803-theme-tile";
      space.widths770=[7.0,7.0,7.0,7.0,7.0,7.0,7.0,7.0,7.0];
      space.safeZones={
        start:{x0:25.766,y0:163.932,x1:33.566,y1:170.432},
        goal:{x0:25.766,y0:9.453,x1:33.566,y1:15.953}
      };
      let line=conservativeRacingLine778(space);
      space.racingSpline770=line;
      space.globalOptimal770=line;
      space.racingLineMode772="generated-v7.793";
    }
  }
  applyTargetedPatch793();

  // ============================================================
  // v7.795 — Sky Cliff targeted endpoint + strict road follow patch
  // ============================================================
  function applyCliffHangerPatch795(){
    const cliff=MAP_DEFINITIONS_770.cliff_hanger;
    if(cliff){
      cliff.route770=[[22.742,33.805],[19.177,30.732],[15.243,27.659],[16.227,22.742],[19.914,19.423],[24.831,18.562],[27.782,14.628],[30.609,10.572],[35.526,9.957],[40.32,11.309],[44.377,14.137],[49.048,15.858],[53.843,17.21],[58.637,18.316],[62.57,21.267],[63.554,26.184],[62.939,31.101],[63.8,36.018],[67.61,39.214],[72.282,40.935],[77.199,41.919],[82.116,42.533],[86.91,43.762],[90.352,47.45],[91.581,52.244],[93.548,56.793],[98.343,58.268],[103.26,59.251],[108.177,59.374],[113.094,59.989],[118.011,59.62],[122.314,62.202],[123.42,67.119],[124.157,72.036],[123.912,76.953],[124.403,81.87],[124.035,86.787],[123.174,91.704],[123.42,96.622],[125.264,101.293],[126.616,106.087],[126.739,111.004],[126.001,115.921],[124.403,120.593],[121.084,124.28],[116.536,126.247],[111.619,126.739],[106.702,126.616],[101.907,125.51],[97.974,122.436],[95.023,118.38],[92.565,113.954],[89.738,109.898],[85.312,107.685],[80.641,105.718],[76.215,103.383],[71.79,101.17],[67.365,98.711],[63.923,95.146],[61.71,90.598],[59.866,85.927],[56.916,81.993],[52.122,80.887],[47.573,82.977],[43.517,85.804],[39.706,89.0],[34.912,90.475],[30.486,92.688],[25.569,92.811],[21.758,96.007],[20.898,100.924],[23.971,104.858],[28.642,106.456],[33.314,108.054],[37.985,109.775],[41.673,113.217],[41.796,118.134],[39.583,122.559],[37.37,126.985],[36.878,131.902],[37.37,136.819],[40.689,140.507],[45.36,142.351],[50.278,142.105],[52.736,137.802],[57.407,139.646],[62.325,139.278]];
      cliff.widths770=[6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8];
      cliff.start={x:22.742,y:33.805};
      cliff.goal={x:62.325,y:139.278};
      cliff.safeZones={
        start:{x0:18.942,y0:30.005,x1:26.542,y1:37.605},
        goal:{x0:58.125,y0:135.078,x1:66.525,y1:143.47799999999998}
      };
      cliff.strictRoadFollow778=true;
      cliff.roadFollowMode778="route-center-hard";
      let line=conservativeRacingLine778(cliff);
      cliff.racingSpline770=line;
      cliff.globalOptimal770=line;
      cliff.racingLineMode772="generated-v7.795";
    }
  }
  applyCliffHangerPatch795();

  // ============================================================
  // 1) Remove the extra 5 small rocks from the artwork and restore a single shared red gate
  // 3) Enforce circuit road-follow so 6->3 and 3->1 stay on the paved lane
  // ============================================================


  // ============================================================
  // v7.80 — 8 MAP FINAL QA NORMALIZATION (Neon Drift untouched)
  // ============================================================
  function applyMapQA780(){
    for(const m of MAP_POOL_770){
      if(m.id==="s_map")continue;
      m.strictRoadFollow778=true;
      m.roadFollowMode778="route-center-hard";
      m.racingLineMode772="generated-v7.80";
      // Keep the traced physical route as the normal-driving authority.
      const line=conservativeRacingLine778(m);
      m.racingSpline770=line;
      m.globalOptimal770=line;
    }
    // These are actual non-drivable obstacles, not generic road-edge walls.
    if(MAP_DEFINITIONS_770.ice_ring) MAP_DEFINITIONS_770.ice_ring.hardForbidden780=true;
  }
  applyMapQA780();

  // ============================================================
  // v7.81 — STAR FISH + ICE CROWN TARGETED ROAD PATH FIX
  // 1) Star Fish: retrace NORMAL driving against the CURRENT gray-road artwork.
  // 2) Ice Crown: keep the central M transition on the broad outer half of the road;
  //    the v7.80 hard-forbidden box must never overlap the legal driving lane.
  // Other map geometry is intentionally unchanged from v7.80.
  // ============================================================
  function applyTargetedPathFix781(){
    const star=MAP_DEFINITIONS_770.star_fish;
    if(star){
      star.route770=[[86.0,28.6],[86.0,31.821],[87.234,31.959],[92.858,37.582],[93.681,40.6],[96.013,44.303],[96.836,47.321],[99.716,53.493],[104.242,58.019],[107.534,58.156],[108.906,58.705],[112.472,59.116],[128.931,59.116],[133.321,60.214],[144.293,60.214],[142.373,60.9],[140.727,60.9],[130.029,71.598],[127.148,74.067],[124.268,75.576],[119.879,79.279],[114.255,84.903],[111.649,84.903],[115.627,88.88],[116.861,92.035],[117.547,95.601],[119.193,97.659],[120.016,101.362],[122.759,106.437],[124.268,113.295],[124.268,120.016],[129.343,125.091],[124.131,120.153],[118.919,120.153],[113.981,118.507],[108.083,115.078],[106.848,113.844],[100.676,110.826],[90.938,104.38],[89.429,103.968],[82.982,103.968],[81.199,104.242],[77.77,106.3],[75.164,108.494],[72.421,109.592],[63.643,114.667],[59.939,117.547],[52.807,120.29],[47.183,120.29],[44.029,123.308],[41.834,123.308],[47.458,117.684],[47.595,112.335],[48.967,107.123],[51.984,101.499],[52.533,98.344],[54.179,95.738],[56.236,89.018],[56.648,88.195],[61.722,83.394],[56.236,83.394],[51.984,79.142],[49.241,77.222],[43.206,71.735],[41.423,71.049],[31.136,60.762],[25.923,60.762],[37.582,60.762],[42.657,59.116],[60.488,58.979],[64.054,58.156],[67.895,57.882],[72.01,53.767],[75.713,45.812],[76.124,43.48],[78.182,40.188],[78.73,37.856],[84.628,31.959],[86.0,31.821],[86.0,28.6]];
      star.widths770=new Array(Math.max(1,star.route770.length-1)).fill(9.0);
      star.strictRoadFollow778=true;
      star.roadFollowMode778="route-center-hard";
      star.extraRoads771=[];
      star.forbiddenZones770=[];
      const line=conservativeRacingLine778(star);
      star.racingSpline770=line;
      star.globalOptimal770=line;
      star.racingLineMode772="generated-v7.81";
      star.roadTrace781="current-gray-road";
    }

    const ice=MAP_DEFINITIONS_770.ice_ring;
    if(ice){
      ice.route770=[[20.377,138.642],[20.314,126.0],[20.314,112.0],[20.314,98.0],[20.314,84.0],[20.314,70.0],[20.55,56.0],[21.3,44.0],[23.4,33.2],[27.6,25.5],[33.6,22.4],[40.2,22.0],[45.5,24.8],[49.1,31.0],[51.6,39.8],[53.4,49.8],[55.1,59.6],[58.8,65.5],[63.7,71.6],[71.099,74.0],[78.5,71.6],[83.4,65.5],[87.0,59.6],[88.8,49.8],[90.6,39.8],[93.1,31.0],[96.7,24.8],[102.0,22.0],[108.6,22.4],[114.6,25.5],[118.8,33.2],[120.9,44.0],[121.65,56.0],[121.95,70.0],[121.95,84.0],[121.95,98.0],[121.946,112.0],[121.946,126.0],[121.946,138.642]];
      ice.widths770=new Array(Math.max(1,ice.route770.length-1)).fill(16.0);
      ice.forbiddenZones770=[{x1:60.5,y1:5.5,x2:81.8,y2:45.5}];
      ice.hardForbidden780=true;
      ice.strictRoadFollow778=true;
      ice.roadFollowMode778="route-center-hard";
      ice.extraRoads771=[];
      const line=conservativeRacingLine778(ice);
      ice.racingSpline770=line;
      ice.globalOptimal770=line;
      ice.racingLineMode772="generated-v7.81";
      ice.wideMRoute781=true;
    }
  }
  applyTargetedPathFix781();

  // ============================================================
  // v7.82 — ROAD-ONLY INSIDE RACING LINE
  // Star Fish / Ice Crown keep the v7.81 physical road corridors.
  // NORMAL racing no longer follows their center trace verbatim:
  // it locally string-pulls across each bend to take the shortest legal inside
  // chord, while every sampled chord must remain inside the map's road ribbon.
  // The physical route itself is NOT shortened, so off-road/exterior space
  // remains unreachable and EVADE/REJOIN keeps the same road authority.
  // ============================================================
  function localInsideRacingLine782(m,maxChord,roadMargin=-.45){
    const src=densifyLine772(m.route770||[],.35);
    if(src.length<3)return (m.route770||[]).map(q=>[q[0],q[1]]);
    const out=[[src[0][0],src[0][1]]];
    let i=0;
    while(i<src.length-1){
      let best=i+1;
      for(let j=i+2;j<src.length;j++){
        if(Math.hypot(src[j][0]-src[i][0],src[j][1]-src[i][1])>maxChord)break;
        // Critical safety rule: the whole chord, not just its endpoints,
        // must stay comfortably inside the traced road corridor.
        if(mapLineInside772(m,src[i],src[j],roadMargin))best=j;
        else break;
      }
      i=best;
      out.push([src[i][0],src[i][1]]);
    }
    let line=densifyLine772(out,.50);
    if(line.length){
      line[0]=[m.route770[0][0],m.route770[0][1]];
      line[line.length-1]=[
        m.route770[m.route770.length-1][0],
        m.route770[m.route770.length-1][1]
      ];
    }
    return line;
  }

  function applyRoadOnlyInsideLine782(){
    const star=MAP_DEFINITIONS_770.star_fish;
    if(star){
      // Moderate local apex cuts: visibly inside, but never a jump between star arms.
      const line=localInsideRacingLine782(star,6.5,-.55);
      star.racingSpline770=line;
      star.globalOptimal770=line;
      star.racingLineMode772="road-inside-v7.82";
      star.insideRoadOnly782=true;
      star.insideChord782=6.5;
    }

    const ice=MAP_DEFINITIONS_770.ice_ring;
    if(ice){
      // The M road is much wider, so a longer legal chord is allowed through
      // the two crown turns and the central U. This removes the needless wide arc.
      const line=localInsideRacingLine782(ice,18.0,-.55);
      ice.racingSpline770=line;
      ice.globalOptimal770=line;
      ice.racingLineMode772="road-inside-v7.82";
      ice.insideRoadOnly782=true;
      ice.insideChord782=18.0;
    }
  }
  applyRoadOnlyInsideLine782();


  // ============================================================
  // v7.83 — GLOBAL SHORTEST LEGAL RACING LINE
  // v7.82 generated a better spline, but strictLocalRoadTarget778 still pulled
  // NORMAL targets back toward the legacy route-center.  These two maps now use
  // an explicitly verified shortest legal line as the authoritative NORMAL path.
  // Every segment stays inside the traced road corridor (0.55 logical-unit margin).
  // ============================================================
  function applyGlobalShortestLine783(){
    const star=MAP_DEFINITIONS_770.star_fish;
    if(star){
      const nodes=[
        [86.000,28.600],[96.248,45.165],[111.135,58.962],[131.126,59.665],
        [133.135,68.492],[127.148,74.067],[115.980,89.781],[124.167,112.838],
        [116.674,119.405],[96.213,107.872],[75.909,107.867],[58.156,118.233],
        [47.520,115.253],[56.099,89.466],[39.709,69.335],[40.350,59.864],
        [61.380,58.773],[75.960,44.413],[86.000,28.600]
      ];
      const line=densifyLine772(nodes,.42);
      star.racingSpline770=line;
      star.globalOptimal770=line;
      star.racingLineMode772="global-shortest-v7.83";
      star.optimizedSplineAuthority783=true;
      star.shortestLegal783=true;
      star.shortestLength783=329.00;
      star.centerRouteLength783=433.53;
      star.insideRoadOnly782=true;
    }

    const ice=MAP_DEFINITIONS_770.ice_ring;
    if(ice){
      const nodes=[
        [20.377,138.642],[20.314,102.000],[31.886,23.286],[51.686,40.276],
        [67.862,72.950],[89.400,46.467],[90.343,41.229],[109.886,23.064],
        [121.950,96.000],[121.946,138.642]
      ];
      const line=densifyLine772(nodes,.42);
      ice.racingSpline770=line;
      ice.globalOptimal770=line;
      ice.racingLineMode772="global-shortest-v7.83";
      ice.optimizedSplineAuthority783=true;
      ice.shortestLegal783=true;
      ice.shortestLength783=361.46;
      ice.centerRouteLength783=385.55;
      ice.insideRoadOnly782=true;
    }
  }
  applyGlobalShortestLine783();

  // ============================================================
  // v7.84 — SAFE EARLY-TURN SHORTEST LINE
  // Star Fish: keep the early apex benefit from v7.83, but restore enough
  // geometric clearance that the rendered unit can never fall outside the road.
  // Ice Crown: re-solve both crown hairpins against the legal road ribbon so the
  // car turns right/down as soon as the inner lane physically opens; it never
  // climbs to the old 11/1-o'clock centerline tops.
  // ============================================================
  function applySafeEarlyTurn784(){
    const star=MAP_DEFINITIONS_770.star_fish;
    if(star){
      const nodes=[
        [86.000,28.600],[102.000,52.100],[105.300,55.400],[112.800,56.600],
        [140.727,60.900],[116.549,86.200],[124.131,120.153],[88.983,106.468],
        [76.683,106.768],[54.783,116.968],[47.183,120.290],[55.323,85.849],
        [41.423,71.049],[37.423,63.500],[63.523,55.700],[66.823,55.400],
        [80.623,40.400],[86.000,28.600]
      ];
      const line=densifyLine772(nodes,.30);
      star.racingSpline770=line;
      star.globalOptimal770=line;
      star.racingLineMode772="safe-shortest-v7.84";
      star.optimizedSplineAuthority783=true;
      star.shortestLegal783=true;
      star.safeShortest784=true;
      star.stallProofSpline784=true;
      star.lockOptimalExecution784=true;
      star.safeClearance784=1.80;
      star.edgeFlow785=true;
      star.shortestLength784=349.35;
      star.centerRouteLength784=433.53;
    }

    const ice=MAP_DEFINITIONS_770.ice_ring;
    if(ice){
      const nodes=[
        [20.377,138.642],[26.564,59.050],[27.614,43.300],[29.364,35.250],
        [32.164,30.350],[35.314,28.600],[38.814,28.250],[41.614,30.000],
        [65.764,64.300],[68.564,67.450],[73.814,67.100],[82.214,58.000],
        [101.464,29.300],[103.914,28.250],[107.064,28.600],[110.214,30.350],
        [113.014,35.950],[114.764,46.100],[115.814,67.800],[121.946,138.642]
      ];
      const line=densifyLine772(nodes,.30);
      ice.racingSpline770=line;
      ice.globalOptimal770=line;
      ice.racingLineMode772="safe-shortest-v7.84";
      ice.optimizedSplineAuthority783=true;
      ice.shortestLegal783=true;
      ice.safeShortest784=true;
      ice.stallProofSpline784=true;
      ice.lockOptimalExecution784=true;
      ice.safeClearance784=1.60;
      ice.edgeFlow785=true;
      ice.shortestLength784=337.12;
      ice.centerRouteLength784=385.55;
      ice.earlyCrownTurn784=true;
    }
  }
  applySafeEarlyTurn784();

  // ============================================================
  // v7.87 — GLOBAL NON-SOLID EDGE + OUTLINE GATES
  // 1) Every map: road edge/rail is visual only. It can be crossed like Neon Drift.
  //    Normal route planning still stays on the road, so this does not invent shortcuts.
  // 2) Star Fish: preserve early optimized turns but pull the authoritative line
  //    toward the traced road center enough to stop visible curb/wall hugging.
  // 3) Ice Crown: use the cleaned map artwork whose START/GOAL boxes are outlines only.
  // ============================================================
  function applyGlobalNonSolidEdge786(){
    for(const m of MAP_POOL_770){
      m.edgePassThrough786=true;
      m.wallCollision786=false;
      m.edgeRailMode786="visual-pass-through";
    }

    const star=MAP_DEFINITIONS_770.star_fish;
    if(star){
      // Re-solve inside the traced road with a full 2.0 logical-unit curb buffer.
      // This is still ~15.6% shorter than the center trace, but no normal segment
      // rides the visual rail/wall line.
      const line=localInsideRacingLine782(star,12.0,-2.0);
      star.racingSpline770=line;
      star.globalOptimal770=line;
      star.racingLineMode772="safe-center-shortest-v7.87";
      star.wallHugFix786=true;
      star.minimumVisualEdgeClearance786=2.0;
      star.shortestLength786=366.042;
      star.centerRouteLength786=433.53;
      star.optimizedSplineAuthority783=true;
      star.stallProofSpline784=true;
      star.edgeFlow785=true;
    }

    const ice=MAP_DEFINITIONS_770.ice_ring;
    if(ice){
      ice.image="map_ice_m_787.png?v=786-outline-gates";
      ice.gateArtwork786="outline-only";
      ice.edgeFlow785=true;
      ice.stallProofSpline784=true;
    }
  }
  applyGlobalNonSolidEdge786();


  // ============================================================
  // v7.87 — ICE CROWN LOAD FIX + CLEAN ART + RETIRED SLOT 6 COURSE REVERSE START
  // 1) Ice Crown: stop using the temporary v7.87 asset reference; use the cleaned
  //    v7.87 artwork and keep the existing safe-shortest geometry/racing line.
  // 2) Heart: restore the pre-mosaic original artwork.
  // 3) retired slot 6 course: remove the outer-left start marker from artwork, make the old
  //    inner-right marker the new START, reverse the route, and launch rightward.
  // ============================================================
  function applyPatch787(){
    const ice=MAP_DEFINITIONS_770.ice_ring;
    if(ice){
      ice.image="map_ice_m_787.png?v=7893-ice-clean-runtime";
      ice.gateArtwork786="outline-only-clean-v787";
      ice.geometryReady=true;
    }

    const heart=MAP_DEFINITIONS_770.neon_city;
    if(heart){
      heart.image="map_heart_7891_clean.png?v=803-theme-tile";
      heart.artworkRestored787=true;
    }

    const black=MAP_DEFINITIONS_770.double_hairpin;
    if(black){
      black.image="map_clover_164.png?v=1640";
      const oldRoute=(black.route770||[]).map(q=>[q[0],q[1]]);
      if(oldRoute.length>=2){
        black.route770=oldRoute.reverse();
        const oldWidths=(black.widths770||[]).slice();
        if(oldWidths.length) black.widths770=oldWidths.reverse();
      }
      // The former inner-right goal becomes the START. Reversed route initially
      // moves +X (right) before continuing naturally along the spiral road.
      black.start={x:77.72,y:96.768};
      black.goal={x:14.6,y:145.0};
      black.safeZones={
        start:{x0:72.72,y0:91.768,x1:82.72,y1:101.768},
        goal:{x0:9.2,y0:139.6,x1:20.0,y1:150.4}
      };
      black.courseType775="point-to-point";
      black.finishRule775="end-gate";
      black.lapRequired775=false;
      black.sharedGate778=false;
      black.retiredSlot6Reverse787=true;
      black.startDirection787="right";
      black.strictRoadFollow778=true;
      black.roadFollowMode778="route-center-hard";
      const line=conservativeRacingLine778(black);
      black.racingSpline770=line;
      black.globalOptimal770=line;
      black.racingLineMode772="reverse-right-start-v7.87";
    }
  }
  applyPatch787();

  // ============================================================
  // v7.88 — RETIRED SLOT 6 COURSE GATE CORRECTION + SPACE +2 ROAD ROWS
  // ============================================================
  function applyPatch788(){
    const black=MAP_DEFINITIONS_770.double_hairpin;
    if(black){
      // v7.87 had yellow/green roles reversed. Restore the opposite gate roles.
      // Start at the outer-left gate; finish at the inner-right gate.
      black.image="map_clover_164.png?v=1640";
      let r=(black.route770||[]).map(q=>[q[0],q[1]]);
      // v7.87 reversed the original route. Put it back to outer -> inner.
      if(black.retiredSlot6Reverse787 && r.length>=2) r=r.reverse();
      black.route770=r;
      if((black.widths770||[]).length) black.widths770=black.widths770.slice().reverse();
      black.start={x:14.6,y:145.0};
      black.goal={x:77.72,y:96.768};
      black.safeZones={
        start:{x0:9.2,y0:139.6,x1:20.0,y1:150.4},
        goal:{x0:72.72,y0:91.768,x1:82.72,y1:101.768}
      };
      black.courseType775="point-to-point";
      black.finishRule775="end-gate";
      black.lapRequired775=false;
      black.sharedGate778=false;
      black.retiredSlot6Reverse787=false;
      black.startDirection788="route-forward";
      black.strictRoadFollow778=true;
      black.roadFollowMode778="route-center-hard";
      const line=conservativeRacingLine778(black);
      black.racingSpline770=line;
      black.globalOptimal770=line;
      black.racingLineMode772="correct-gates-v7.88";
    }

    const space=MAP_DEFINITIONS_770.skyway;
    if(space){
      // Widen the physical/player road by two logical rows total (+1 each side).
      space.widths770=(space.widths770||[]).map(w=>w+1.0);
      space.special=Object.assign({},space.special,{wideRoad:true});
      space.spaceRoadRowsAdded788=2;
      space.image="map_space_894.png?v=803-theme-tile";
      const line=conservativeRacingLine778(space);
      space.racingSpline770=line;
      space.globalOptimal770=line;
      space.racingLineMode772="wider-road-v7.88";
    }
  }
  applyPatch788();


  // ============================================================
  // v7.89 — GLOBAL SLIGHT-INSIDE TUNE + OUTER-REGION SOFT LIMIT
  // Goal:
  // - NORMAL racing is a little more inside at real bends.
  // - Do not intentionally take exaggerated outside arcs.
  // - Road edge/rail remains pass-through (not a wall). If an air unit drifts far
  //   beyond the road, it naturally REJOINs; there is no snap/rollback/death.
  // ============================================================
  function mapRouteInfo789(m,x,y){
    const rr=m?.route770||[],ww=m?.widths770||[];
    let best=null,bestD=Infinity;
    for(let i=0;i<rr.length-1;i++){
      const a=rr[i],b=rr[i+1],dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy||1;
      const u=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/L2));
      const cx=a[0]+dx*u,cy=a[1]+dy*u,L=Math.sqrt(L2),ux=dx/L,uy=dy/L,nx=-uy,ny=ux;
      const ex=x-cx,ey=y-cy,d2=ex*ex+ey*ey;
      if(d2<bestD){
        bestD=d2;
        best={i,cx,cy,ux,uy,nx,ny,lat:ex*nx+ey*ny,half:Math.max(.55,Number(ww[i]??ww[0]??10)*.5),d2};
      }
    }
    return best;
  }

  function mapTurn789(m,i){
    const rr=m?.route770||[];
    if(rr.length<3)return {side:0,power:0};
    let score=0,weight=0,pMax=0;
    for(let k=0;k<5;k++){
      const j=Math.max(0,Math.min(rr.length-3,(i|0)+k));
      const a=rr[j],b=rr[j+1],c=rr[j+2];
      let x1=b[0]-a[0],y1=b[1]-a[1],x2=c[0]-b[0],y2=c[1]-b[1];
      const l1=Math.hypot(x1,y1)||1,l2=Math.hypot(x2,y2)||1;
      x1/=l1;y1/=l1;x2/=l2;y2/=l2;
      const cross=x1*y2-y1*x2;
      const dot=Math.max(-1,Math.min(1,x1*x2+y1*y2));
      const power=Math.acos(dot)/Math.PI;
      if(power>.018 && Math.abs(cross)>.01){
        // Existing engine convention: screen-space negative cross = visual left,
        // and the inside lane is negative route-normal offset.
        const side=cross<0?-1:1,w=power/(1+k*.62);
        score+=side*w;weight+=w;pMax=Math.max(pMax,power);
      }
    }
    if(weight<.006)return {side:0,power:0};
    return {side:Math.sign(score)||0,power:Math.min(1,pMax*4.2)};
  }
  function mapForbiddenPoint789(m,x,y,pad=.10){
    if(!m?.hardForbidden780)return false;
    for(const z of (m.forbiddenZones770||[])){
      if(x>=z.x1-pad&&x<=z.x2+pad&&y>=z.y1-pad&&y<=z.y2+pad)return true;
    }
    return false;
  }


  function mapRoadPoint789(m,x,y,margin=-.18){
    if(!m)return false;
    if(m.id==='s_map')return true; // S-map keeps its hand-tuned spline; runtime guard still applies.
    return genericCourseMask771(m,x,y,margin)&&!mapForbiddenPoint789(m,x,y,.08);
  }

  function mapRoadSegment789(m,a,b,margin=-.14){
    if(m.id==='s_map')return true;
    const d=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(2,Math.ceil(d/.24));
    for(let k=0;k<=n;k++){
      const t=k/n,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
      if(!mapRoadPoint789(m,x,y,margin))return false;
    }
    return true;
  }

  function tuneRacingSpline789(m){
    const src=(m?.racingSpline770||[]).map(q=>[q[0],q[1]]);
    if(m?.id==='s_map'||src.length<3)return src;
    const out=src.map(q=>[q[0],q[1]]);
    const star=m.id==='star_fish', narrow=m.id==='skyway'||m.id==='cliff_hanger';
    for(let i=1;i<src.length-1;i++){
      const q=src[i],info=mapRouteInfo789(m,q[0],q[1]);
      if(!info)continue;
      const turn=mapTurn789(m,info.i),half=info.half;
      let lat=info.lat;
      if(turn.side){
        let signed=lat*turn.side; // + = inside, - = outside
        const outsideCap=half*(star?.28:narrow?.34:.38);
        const insideCap=half*(star?.55:narrow?.66:.70);
        // Never keep a large outside setup arc.
        signed=Math.max(-outsideCap,signed);
        // Small universal inside nudge; strongest only where a real bend is nearby.
        const push=Math.min(.34,half*.055)*(.38+turn.power*.62);
        if(signed<insideCap) signed=Math.min(insideCap,signed+push);
        lat=signed*turn.side;
      }else{
        // On straights there is no reason to cruise near an outer edge.
        const cap=half*(star?.50:narrow?.58:.60);
        lat=Math.max(-cap,Math.min(cap,lat));
      }
      const c=[info.cx+info.nx*lat,info.cy+info.ny*lat];
      if(!mapRoadPoint789(m,c[0],c[1],-.22))continue;
      if(!mapRoadSegment789(m,out[i-1],c,-.16))continue;
      if(!mapRoadSegment789(m,c,src[i+1],-.16))continue;
      out[i]=c;
    }
    out[0]=src[0];out[out.length-1]=src[src.length-1];
    return out;
  }

  function softLaneTarget789(p,t,mode){
    if(!t)return t;
    const m=currentMap770();
    if(m.id==='triple_diamond'){
      destinyPath813(p);
      const prog=Math.max(0,Number(p._dgProg813)||0);
      const look=mode==='EVADE'?2.25:2.05;
      const q=destinyPoint813(p,Math.min(p._dgSegs813.total,prog+look));
      // Route authority is always the racer's chosen personal branch.
      // Observer AI may change lateral offset, never choose another road leg.
      return {...t,x:q.x,y:q.y,kind:(t.kind||'race720')+'-destiny818'};
    }

    // v7.95: edge rails stay pass-through, but an EVADE/REJOIN target may not
    // connect to another nearby road leg by a diagonal chord. When that happens,
    // fall back to a forward point on the authoritative spline at the same progress.
    if(m.strictNoChord795 && mode!=='NORMAL'){
      const sameLeg=mapRoadSegment789(m,[p.x,p.y],[t.x,t.y],-.62);
      const forbiddenChord=mapForbiddenPoint789(m,t.x,t.y,.04);
      if(!sameLeg || forbiddenChord){
        const prog=Number.isFinite(p._splineProg720)?p._splineProg720:nearestSplineProgress720(p.x,p.y);
        const look=mode==='EVADE'?2.20:2.70;
        const q=splinePointAt720(Math.min(RACING_SPLINE_SEGS_720.total,prog+look));
        p._noChordGuards795=(p._noChordGuards795||0)+1;
        return {...t,x:q.x,y:q.y,kind:(t.kind||'race720')+'-no-chord795'};
      }
    }
    // v7.896 retired slot 6 course hard center: never project an EVADE target onto the
    // nearest spiral ring (which can be the adjacent lane). Use the authoritative
    // center spline progress itself for NORMAL / EVADE / REJOIN.
    if(m.retiredSlot6HardCenter896){
      p.desiredOffset=0; p.routeBand=0; p.openingLineBias=0;
      const prog=Number.isFinite(p._splineProg720)?p._splineProg720:nearestSplineProgress720(p.x,p.y);
      const look=mode==='NORMAL'?5.20:3.10;
      const q=splinePointAt720(Math.min(RACING_SPLINE_SEGS_720.total,prog+look));
      return {...t,x:q.x,y:q.y,kind:(t.kind||'race720')+'-hard-center896'};
    }
    const info=mapRouteInfo789(m,t.x,t.y);
    if(!info)return t;
    const turn=mapTurn789(m,info.i),half=info.half;
    let lat=info.lat;
    // v7.895 retired slot 6 course: keep every steering mode close to the traced spiral
    // center so adjacent rings are never selected as a "wide" lane.
    if(m.retiredSlot6CenterOnly895){
      const frac=mode==='EVADE'?.24:mode==='REJOIN'?.14:.08;
      lat=Math.max(-half*frac,Math.min(half*frac,lat));
      const x=info.cx+info.nx*lat,y=info.cy+info.ny*lat;
      return {...t,x,y,kind:(t.kind||'race720')+'-black-center895'};
    }
    if(turn.side){
      let signed=lat*turn.side;
      const outsideFrac=m.insideAi795?(mode==='EVADE'?.64:mode==='REJOIN'?.43:.31):(mode==='EVADE'?.72:mode==='REJOIN'?.52:.40);
      const insideFrac=m.insideAi795?(mode==='EVADE'?.92:mode==='REJOIN'?.82:.80):(mode==='EVADE'?.90:mode==='REJOIN'?.76:.72);
      signed=Math.max(-half*outsideFrac,Math.min(half*insideFrac,signed));
      lat=signed*turn.side;
    }else{
      const frac=m.insideAi795?(mode==='EVADE'?.76:mode==='REJOIN'?.56:.52):(mode==='EVADE'?.80:mode==='REJOIN'?.62:.60);
      lat=Math.max(-half*frac,Math.min(half*frac,lat));
    }
    const x=info.cx+info.nx*lat,y=info.cy+info.ny*lat;
    if(visualRoadMask674(x,y,info.i)&&courseContainsPoint(x,y,0)&&
       !(m.hardForbidden780&&inForbidden96(x,y,0))&&actualRoadChord719(p.x,p.y,x,y))
      return {...t,x,y,kind:(t.kind||'race720')+'-soft789'};
    return t;
  }



  function applyGlobalInsideTune789(){
    for(const m of MAP_POOL_770){
      m.outerSoftLimit789=true;
      m.edgePassThrough786=true; // reaffirm: this limiter is NOT a wall.
      if(m.id==='s_map'){
        m.insideTune789='existing-optimized+runtime-bias';
        continue;
      }
      const tuned=tuneRacingSpline789(m);
      if(tuned.length>=3){
        m.racingSpline770=tuned;
        m.globalOptimal770=tuned;
        m.insideTune789='slight-inside-no-wide-outside';
        m.racingLineMode772=(m.racingLineMode772||'generated')+'+v7.89';
      }
    }
  }
  applyGlobalInsideTune789();


  // hard-obstacle rollback/rejoin loop.  Restore enough real road width for the
  // narrow side passages and use a prevalidated continuous bypass spline.
  // v1.67.0 cleanup: obsolete v7.892 retired-slot Clover route removed.


  // ============================================================
  // v7.893 — Mosaic cleanup + Heart runtime refresh + tighter retired slot 6 course line
  // 1) Use the clean Heart/Ice artwork for thumbnails and runtime so leftover
  //    gray mosaic/checker patches are gone.
  // 2) Reaffirm the Heart shared red gate runtime setup with the clean asset.
  // 3) Pull retired slot 6 course's normal racing line slightly inward so it does not
  //    take a huge outer setup arc that leaks into the adjacent lane.
  // ============================================================
  function applyPatch7893(){
    const ice=MAP_DEFINITIONS_770.ice_ring;
    if(ice){
      ice.image="map_ice_m_787.png?v=7893-ice-clean-runtime";
      ice.artworkRestored893=true;
    }

    const heart=MAP_DEFINITIONS_770.neon_city;
    if(heart){
      const p=[71.099,126.205];
      heart.image="map_heart_7891_clean.png?v=803-theme-tile";
      heart.start={x:p[0],y:p[1]};
      heart.goal={x:p[0],y:p[1]};
      if(Array.isArray(heart.route770) && heart.route770.length>=2){
        heart.route770[0]=[p[0],p[1]];
        heart.route770[heart.route770.length-1]=[p[0],p[1]];
      }
      const h=7.0;
      heart.safeZones={
        start:{x0:p[0]-h,y0:p[1]-h,x1:p[0]+h,y1:p[1]+h},
        goal:{x0:p[0]-h,y0:p[1]-h,x1:p[0]+h,y1:p[1]+h}
      };
      heart.sharedGate778=true;
      heart.courseType775="circuit";
      heart.finishRule775="one-lap-gate";
      heart.lapRequired775=true;
      heart.lapArmFraction775=.82;
      let line=conservativeRacingLine778(heart);
      heart.racingSpline770=line;
      heart.globalOptimal770=line;
      heart.racingLineMode772="heart-shared-red-gate-v7.893";
      heart.heartRuntimeRefresh893=true;
    }

    const black=MAP_DEFINITIONS_770.double_hairpin;
    if(black){
      if(Array.isArray(black.widths770)&&black.widths770.length){
        black.widths770=black.widths770.map(()=>12.6);
      }
      let tuned=tuneRacingSpline789(black);
      if(tuned.length>=3){
        black.racingSpline770=tuned;
        black.globalOptimal770=tuned;
        tuned=tuneRacingSpline789(black);
      }
      if(tuned.length>=3){
        black.racingSpline770=tuned;
        black.globalOptimal770=tuned;
      }
      black.racingLineMode772=(black.racingLineMode772||'outer-to-inner-spiral-v7.892')+"+inboard-v7.893";
      black.insideTune789="tighter-inboard-spiral-v7.893";
      black.outerSoftLimit789=true;
      black.retiredSlot6LaneTight893=true;
    }
  }
  applyPatch7893();


  // ============================================================
  // v7.894 — Star Fish stall guard + retired slot 6 course single yellow gate + Desert cleanup
  // 1) Star Fish: use a safer, more center-biased authoritative racing spline and
  //    a slightly wider legal ribbon so touching the visual wall no longer makes
  //    racers appear to stall or pin in place.
  // 2) retired slot 6 course: refresh the runtime artwork to the fully single-yellow version.
  // 3) Desert Oasis: refresh the cleaned artwork so the start-side mosaic is gone.
  // ============================================================
  function applyPatch7894(){
    const star=MAP_DEFINITIONS_770.star_fish;
    if(star){
      star.image="map_star_fish_791.png?v=803-theme-tile";
      star.widths770=new Array(Math.max(1,(star.route770||[]).length-1)).fill(9.6);
      star.strictRoadFollow778=true;
      star.roadFollowMode778="route-center-hard";
      star.edgePassThrough786=true;
      star.wallCollision786=false;
      star.edgeFlow785=true;
      star.outerSoftLimit789=true;
      const nodes=[
        [86.000,28.600],[98.600,44.800],[112.200,57.800],[132.900,60.000],
        [124.200,74.600],[115.600,88.400],[123.600,118.000],[111.000,116.200],
        [95.200,108.600],[77.200,108.600],[58.300,118.000],[52.800,105.800],
        [56.400,88.800],[42.100,71.100],[43.700,60.300],[63.000,58.500],
        [76.400,44.400],[86.000,28.600]
      ];
      const line=densifyLine772(nodes,.30);
      star.racingSpline770=line;
      star.globalOptimal770=line;
      star.racingLineMode772="stall-guard-centerline-v7.894";
      star.optimizedSplineAuthority783=true;
      star.shortestLegal783=true;
      star.safeShortest784=true;
      star.stallProofSpline784=true;
      star.lockOptimalExecution784=true;
      star.wallHugFix786=true;
      star.minimumVisualEdgeClearance786=2.8;
      star.starFishStallFix894=true;
    }

    const black=MAP_DEFINITIONS_770.double_hairpin;
    if(black){
      black.image="map_clover_164.png?v=1640";
      black.leftDuplicateGateRemoved892=true;
      black.retiredSlot6SingleYellow894=true;
    }

    const desert=MAP_DEFINITIONS_770.desert_oasis;
    if(desert){
      desert.image="map_desert_oasis_899.png?v=803-theme-tile";
      desert.desertStartClean894=true;
    }
  }
  applyPatch7894();


  // ============================================================
  // v7.895 — STAR FISH TRUE PASS-THROUGH + RETIRED SLOT 6 COURSE CENTERLINE LOCK
  // ============================================================
  function applyPatch7895(){
    const star=MAP_DEFINITIONS_770.star_fish;
    if(star){
      star.edgePassThrough786=true;
      star.wallCollision786=false;
      star.edgeRailMode786="visual-pass-through";
      star.starFishNoEdgeRollback895=true;
      star.starFishNoOuterStateTrigger895=true;
      // Keep the safer v7.894 normal line; only remove the last hidden wall behavior.
    }

    const black=MAP_DEFINITIONS_770.double_hairpin;
    if(black){
      // The traced v7.892 spiral is the road center. Do not run inside/outside
      // optimization over it: follow this center all the way to the green goal.
      const center=densifyLine772((black.route770||[]).map(q=>[q[0],q[1]]),.28);
      black.racingSpline770=center;
      black.globalOptimal770=center;
      black.lockOptimalExecution784=true;
      black.strictRoadFollow778=true;
      black.roadFollowMode778="route-center-hard";
      black.retiredSlot6CenterOnly895=true;
      black.racingLineMode772="spiral-road-center-v7.895";
      black.insideTune789="centerline-only-v7.895";
      black.outerSoftLimit789=true;
    }
  }
  applyPatch7895();


  // ============================================================
  // v7.896 — RETIRED SLOT 6 COURSE EXACT CENTER + SPACE +2 MORE ROAD ROWS
  // ============================================================
  function applyPatch7896(){
    const black=MAP_DEFINITIONS_770.double_hairpin;
    if(black){
      const center=densifyLine772((black.route770||[]).map(q=>[q[0],q[1]]),.24);
      black.racingSpline770=center;
      black.globalOptimal770=center;
      black.lockOptimalExecution784=true;
      black.optimizedSplineAuthority783=true;
      black.strictRoadFollow778=true;
      black.roadFollowMode778="route-center-hard";
      black.retiredSlot6CenterOnly895=true;
      black.retiredSlot6HardCenter896=true;
      black.racingLineMode772="exact-gray-road-center-v7.896";
      black.insideTune789="disabled-center-only-v7.896";
      black.outerSoftLimit789=true;
    }

    const space=MAP_DEFINITIONS_770.skyway;
    if(space){
      // v7.88 added a logical +1 per side but the artwork still looked nearly
      // unchanged. v7.896 adds two more logical rows total and uses a visibly
      // widened road asset (+16 px each side through the straight corridor).
      space.widths770=(space.widths770||[]).map(w=>w+2.0);
      space.special=Object.assign({},space.special,{wideRoad:true});
      space.spaceRoadRowsAdded896=2;
      space.spaceRoadTotalExtra896=4;
      space.image="map_space_894.png?v=803-theme-tile";
      const line=conservativeRacingLine778(space);
      space.racingSpline770=line;
      space.globalOptimal770=line;
      space.racingLineMode772="wider-road-v7.896";
    }
  }
  applyPatch7896();


  // ============================================================
  // v7.897 — TRUE RETIRED SLOT 6 COURSE GRAY-ROAD CENTER + SPACE 4 ROWS
  // ============================================================
  function applyPatch7897(){
    const black=MAP_DEFINITIONS_770.double_hairpin;
    if(black){
      // This path was re-traced from the actual gray roadway artwork; it is not
      // the old approximate spiral and is intentionally NOT inside-biased.
      black.route770=[[20.007,149.93],[21.159,150.925],[23.415,150.884],[26.795,151.159],[31.304,151.391],[36.116,151.609],[41.235,151.779],[46.665,151.891],[52.409,151.93],[58.084,151.72],[63.686,151.256],[69.206,150.55],[74.64,149.617],[79.828,148.391],[84.772,146.892],[89.467,145.135],[93.92,143.129],[98.144,140.922],[102.147,138.515],[105.945,135.905],[109.546,133.086],[112.997,129.888],[116.292,126.295],[119.41,122.291],[122.326,117.861],[124.934,113.154],[127.218,108.175],[129.179,102.929],[130.823,97.425],[132.037,91.906],[132.828,86.376],[133.202,80.842],[133.172,75.308],[132.705,69.814],[131.795,64.361],[130.426,58.951],[128.576,53.592],[126.235,48.614],[123.407,44.032],[120.123,39.86],[116.41,36.087],[112.41,32.813],[108.137,30.011],[103.594,27.663],[98.77,25.754],[93.807,24.165],[88.692,22.912],[83.411,22.012],[77.96,21.481],[72.577,21.404],[67.266,21.784],[62.035,22.615],[56.889,23.9],[51.99,25.529],[47.35,27.51],[42.976,29.845],[38.878,32.529],[35.14,35.47],[31.76,38.655],[28.739,42.068],[26.075,45.704],[23.773,49.482],[21.84,53.395],[20.277,57.444],[19.076,61.621],[18.181,65.758],[17.567,69.849],[17.21,73.873],[17.083,77.831],[17.201,81.731],[17.549,85.588],[18.036,89.452],[18.782,93.326],[19.746,96.96],[20.924,100.348],[22.315,103.494],[23.914,106.4],[25.638,108.985],[27.479,111.253],[29.412,113.187],[31.453,114.828],[33.919,116.321],[36.846,117.676],[40.263,118.888],[44.159,119.935],[48.324,120.805],[52.751,121.492],[57.42,122.023],[62.324,122.352],[67.059,122.375],[71.607,122.109],[75.97,121.62],[80.15,120.876],[84.152,119.802],[87.982,118.404],[91.653,116.679],[95.163,114.634],[98.316,112.316],[101.117,109.731],[103.601,106.85],[105.771,103.66],[107.667,100.23],[109.285,96.553],[110.616,92.633],[111.654,88.485],[112.279,84.521],[112.496,80.761],[112.317,77.183],[111.748,73.775],[110.831,70.567],[109.567,67.547],[107.952,64.703],[105.982,62.03],[103.736,59.642],[101.265,57.455],[98.521,55.381],[95.427,53.49],[92.198,51.789],[88.822,50.335],[85.309,49.185],[81.664,48.383],[77.986,47.95],[74.299,47.888],[70.627,48.181],[66.994,48.803],[63.656,49.762],[60.629,51.024],[57.883,52.572],[55.403,54.393],[53.172,56.355],[51.168,58.449],[49.373,60.663],[47.688,62.95],[46.194,65.369],[44.906,67.944],[43.829,70.671],[42.893,73.526],[42.024,76.3],[41.338,79.057],[40.917,81.847],[40.873,84.666],[41.277,87.439],[42.109,90.13],[43.284,92.734],[44.728,95.284],[46.474,97.687],[48.565,99.933],[51.054,102.005],[53.928,103.893],[56.871,105.567],[59.868,107.094],[62.942,108.497],[66.135,109.722],[69.362,110.677],[72.626,111.295],[75.912,111.581],[79.217,111.597],[82.405,111.429],[85.507,111.061],[88.511,110.407],[91.371,109.376],[94.018,107.959],[96.343,106.107],[98.383,103.978],[100.186,101.638],[101.754,99.176],[103.09,96.594],[104.204,93.875],[105.095,91.015],[105.68,88.125],[105.955,85.202],[105.91,82.288],[105.492,79.393],[104.624,76.652],[103.418,74.084],[101.924,71.705],[100.196,69.494],[98.347,67.51],[96.384,65.739],[94.299,64.18],[92.102,62.831],[89.853,61.696],[87.574,60.723],[85.262,59.856],[82.892,59.068],[80.541,58.444],[78.168,58.031],[75.755,57.902],[73.317,58.118],[70.999,58.662],[68.819,59.505],[66.763,60.585],[64.797,61.854],[63.0,63.227],[61.356,64.741],[59.9,66.44],[58.702,68.363],[57.808,70.398],[57.275,72.52],[57.089,74.696],[57.173,76.879],[57.458,78.976],[57.88,81.014],[58.452,83.022],[59.247,85.003],[60.361,86.784],[61.782,88.33],[63.56,89.508],[65.306,90.777],[67.052,91.888],[68.797,92.841],[70.543,93.634],[72.289,94.269],[73.836,94.769],[75.185,95.134],[76.336,95.364],[77.288,95.459],[78.002,95.531],[78.478,95.578],[78.738,95.661]];
      black.widths770=new Array(Math.max(1,black.route770.length-1)).fill(13.5);
      const exact=densifyLine772(black.route770,.20);
      black.racingSpline770=exact;
      black.globalOptimal770=exact;
      black.lockOptimalExecution784=true;
      black.optimizedSplineAuthority783=true;
      black.strictRoadFollow778=true;
      black.roadFollowMode778="route-center-hard";
      black.retiredSlot6CenterOnly895=true;
      black.retiredSlot6HardCenter896=true;
      black.retiredSlot6ExactCenter897=true;
      black.racingLineMode772="actual-gray-road-center-v7.897";
      black.insideTune789="OFF-exact-center-v7.897";
      black.outerSoftLimit789=false;
    }

    const space=MAP_DEFINITIONS_770.skyway;
    if(space){
      // Base Space was 5.8 logical units wide (2 visible rows). 11.6 is an exact
      // 2x road width = 4 visible rows, matching the widened artwork.
      space.widths770=new Array(Math.max(1,(space.route770||[]).length-1)).fill(11.6);
      space.special=Object.assign({},space.special,{wideRoad:true});
      space.spaceRoadRows897=4;
      space.spaceRoadDoubleWidth897=true;
      space.image="map_space_894.png?v=803-theme-tile";
      const line=conservativeRacingLine778(space);
      space.racingSpline770=line;
      space.globalOptimal770=line;
      space.racingLineMode772="four-row-road-v7.897";
    }
  }
  applyPatch7897();

  // ============================================================
  //   remaining visible gray-road gap beside each rock.
  // ============================================================


  // ============================================================
  // v7.899 — START/GATE ARTIFACT CLEANUP
  // Replace active artwork that still carried old copied-square / mosaic remnants.
  // ============================================================
  function applyPatch7899(){
    const desert=MAP_DEFINITIONS_770.desert_oasis;
    if(desert){
      desert.image="map_desert_oasis_899.png?v=803-theme-tile";
      desert.imageFallback791="map_desert_oasis_899.png?v=803-theme-tile";
      desert.startArtifactClean899=true;
      desert.mapLoadSafe791=true;
    }
    const cliff=MAP_DEFINITIONS_770.cliff_hanger;
    if(cliff){
      cliff.image="map_cliff_hanger_899.png?v=803-theme-tile";
      cliff.imageFallback791="map_cliff_hanger_899.png?v=803-theme-tile";
      cliff.startArtifactClean899=true;
      cliff.mapLoadSafe791=true;
    }
    // retired slot 6 course keeps its current gameplay route; only artwork cleanup metadata.
    const black=MAP_DEFINITIONS_770.double_hairpin;
    if(black) black.startArtifactAudit899=true;
  }
  applyPatch7899();

  // ============================================================
  // ============================================================
  function applyPatch791(){
    const desert=MAP_DEFINITIONS_770.desert_oasis;
    if(desert){
      desert.mapLoadSafe791=true;
      desert.imageFallback791="map_desert_oasis_899.png?v=803-theme-tile";
    }
    const cliff=MAP_DEFINITIONS_770.cliff_hanger;
    if(cliff){
      cliff.mapLoadSafe791=true;
      cliff.imageFallback791="map_cliff_hanger_899.png?v=803-theme-tile";
    }

  }
  applyPatch791();

  // ============================================================
  // 1) Rocks 2/3: right/outside passage is forbidden; use left narrow gap only.
  // 2) Bottom 6->3 section follows the visible road curve; no diagonal chord.
  // 4) An accidental obstacle entry is guided forward on the legal spline instead
  //    of rolling back to the previous point, eliminating the visible freeze loop.
  // ============================================================


  // ============================================================
  // v7.95 — UNIFIED 9-MAP DRIVING STABILITY + INSIDE AI + NO-CHORD GUARD
  // Combines the planned v7.944 / v7.95 / v7.96 work:
  // 1) common anti-stall / anti-bounce runtime stability on all 9 active maps,
  // 2) stronger inside-line preference without overwriting map-specific splines,
  // 3) prevent EVADE/REJOIN targets from cutting across a different gray-road leg.
  // Visual one-row edge rails remain pass-through and are NOT physical walls.
  // ============================================================
  function applyPatch795(){
    for(const m of MAP_POOL_770){
      m.driveStability795=true;
      m.edgePassThrough786=true;
      m.noDiagonalChord795=true;
      m.noReverseRouteJump795=true;
      m.cornerFlow795=true;
      m.insideAi795=true;
      // Keep every established map-specific racing spline. v7.95 adjusts only
      // runtime target choice, so Star/Ice/Rolling/retired slot 6 course fixes are preserved.
    }

    // Maps where adjacent road legs are physically close need the strictest
    // same-leg protection. retired slot 6 course already has exact-center authority.
    for(const id of ['ice_ring','double_hairpin']){
      const m=MAP_DEFINITIONS_770[id];
      if(m)m.strictNoChord795=true;
    }

    // Neon Drift opening remains the validated upper/inside S-course launch.
    const neon=MAP_DEFINITIONS_770.s_map;
    if(neon)neon.openingInsideLock795=true;


  }
  applyPatch795();


  // The previous endpoint-only check could miss a rock if one frame entered and
  // exited the circular body. Sample the whole physical step and return the first
  // entry fraction so collision is identical from above, below, left, or right.





  function applyMapDefinition770(id,opts={}){
    const next=MAP_DEFINITIONS_770[id];
    if(!next)return {ok:false,reason:"unknown-map",id};
    if(!next.geometryReady||!next.route770||!next.racingSpline770||
       (next.id==="s_map"&&typeof next.roadMask770!=="function"))
      return {ok:false,reason:"geometry-not-ready",id,name:next.name};

    activeMapId770=id;activeMap770=next;
    const logical777=next.logicalSize||{w:172,h:178};
    MAP_W=Number(logical777.w)||172;MAP_H=Number(logical777.h)||178;
    resizeObserverGrid777();
    route=next.route770.map(p=>[...p]);
    widths=[...(next.widths770||[])];
    GLOBAL_OPTIMAL_LINE_710=next.globalOptimal770||next.racingSpline770;
    RACING_SPLINE_720=next.racingSpline770;
    rebuildRouteGeometry770();rebuildGlobalOptimal770();rebuildRacingSpline770();
    applyMapImage770(next);

    if(opts.reset!==false && typeof resetRound==="function")resetRound();
    return {ok:true,id:next.id,name:next.name,routeLength,splineLength:RACING_SPLINE_LENGTH_720};
  }


  function selectMap770(id){return applyMapDefinition770(id,{reset:true});}

  // ============================================================
  // v7.74 STEP 1 — MAP SELECT UI
  // UI only: map geometry / start-finish rules are intentionally unchanged here.
  // ============================================================
  function populateMapSelect774(){
    if(!mapSelect774)return;
    const selected=currentMap770().id;
    mapSelect774.textContent="";
    [...MAP_POOL_770].sort((a,b)=>a.slot-b.slot).forEach(m=>{
      const opt=document.createElement("option");
      opt.value=m.id;
      opt.textContent=`${m.slot}. ${m.name} · ${m.en}`;
      opt.disabled=!m.geometryReady;
      mapSelect774.appendChild(opt);
    });
    mapSelect774.value=selected;
    mapSelect774.title=`현재 맵: ${currentMap770().name}`;
  }

  function syncMapSelect774(){
    if(!mapSelect774)return;
    mapSelect774.value=currentMap770().id;
    mapSelect774.title=`현재 맵: ${currentMap770().name}`;
  }

  function clearMiniMap774(){
    const mc=document.getElementById("miniMap");
    if(!mc)return;
    const mx=mc.getContext("2d");
    mx.clearRect(0,0,mc.width,mc.height);
  }

  function selectMapFromUI774(id){
    const result=selectMap770(id);
    if(!result.ok){
      syncMapSelect774();
      return result;
    }
    syncMapSelect774();
    clearMiniMap774();
    // renderMiniMap() is forced again when the new image fires its load event.
    if(typeof lastMiniMapRender!=="undefined")lastMiniMapRender=0;
    return result;
  }

  if(mapSelect774){
    populateMapSelect774();
    mapSelect774.addEventListener("change",e=>selectMapFromUI774(e.target.value));
  }
  if(mapSelectIcon774){
    mapSelectIcon774.addEventListener("click",()=>{
      if(!mapSelect774)return;
      mapSelect774.focus();
      try{ if(typeof mapSelect774.showPicker==="function")mapSelect774.showPicker(); }catch(e){}
    });
  }

  function clamp01720(v){ return Math.max(0,Math.min(1,v)); }
  function stat720(p,key,fallback=60){
    const v=Number(p?.stats?.[key]);
    return clamp01720((Number.isFinite(v)?v:fallback)/100);
  }

  function driverSkill739(p){
    if(p && p._driverSkill739)return p._driverSkill739;
    const g=k=>stat720(p,k,60);
    const s={
      pace:g("pace"),acceleration:g("acceleration"),cornering:g("cornering"),
      insideLine:g("insideLine"),routeReading:g("routeReading"),avoidance:g("avoidance"),
      reaction:g("reaction"),prediction:g("prediction"),control:g("control"),
      stability:g("stability"),braking:g("braking"),recovery:g("recovery"),
      consistency:g("consistency"),focus:g("focus"),aggression:g("aggression"),
      riskControl:g("riskControl"),pressure:g("pressure"),start:g("start"),
      endurance:g("endurance"),luck:g("luck")
    };
    s.awareness=s.prediction*.34+s.reaction*.24+s.focus*.18+s.routeReading*.14+s.consistency*.10;
    s.line=s.insideLine*.30+s.cornering*.23+s.routeReading*.19+s.control*.18+s.consistency*.10;
    s.survival=s.avoidance*.25+s.prediction*.18+s.reaction*.15+s.control*.14+
      s.riskControl*.12+s.stability*.08+s.focus*.05+s.recovery*.03;
    s.hand=s.control*.34+s.avoidance*.24+s.stability*.17+s.reaction*.12+s.consistency*.08+s.pressure*.05;
    s.corner=s.cornering*.34+s.braking*.22+s.insideLine*.18+s.control*.14+s.routeReading*.12;
    s.rejoin=s.recovery*.34+s.acceleration*.22+s.control*.18+s.routeReading*.14+s.stability*.12;
    s.mental=s.consistency*.28+s.focus*.25+s.pressure*.25+s.stability*.14+s.riskControl*.08;
    s.speed=s.pace*.48+s.acceleration*.19+s.endurance*.14+s.consistency*.10+s.cornering*.06+s.luck*.03;
    s.startSkill=s.start*.35+s.reaction*.22+s.acceleration*.18+s.focus*.12+s.pressure*.08+s.consistency*.05;
    s.judgment=s.prediction*.25+s.routeReading*.22+s.riskControl*.19+s.avoidance*.14+s.control*.12+s.consistency*.08;
    s.overall=s.speed*.19+s.line*.16+s.survival*.25+s.hand*.11+s.corner*.10+
      s.rejoin*.06+s.mental*.05+s.startSkill*.04+s.judgment*.04;
    if(p)p._driverSkill739=s;
    return s;
  }

  function driverExecution720(p){
    const s=driverSkill739(p);
    return {
      maxSpeed:s.pace,inside:s.insideLine,corner:s.cornering,control:s.control,
      prediction:s.prediction,reaction:s.reaction,avoidance:s.avoidance,
      recovery:s.recovery,riskControl:s.riskControl,consistency:s.consistency,
      routeReading:s.routeReading,focus:s.focus,stability:s.stability,
      braking:s.braking,acceleration:s.acceleration,endurance:s.endurance,
      aggression:s.aggression,pressure:s.pressure,luck:s.luck,
      awareness:s.awareness,line:s.line,survival:s.survival,hand:s.hand,
      cornerSkill:s.corner,rejoinSkill:s.rejoin,mental:s.mental,
      speedSkill:s.speed,startSkill:s.startSkill,judgment:s.judgment,overall:s.overall
    };
  }


  // ============================================================
  // v7.50 ~ v7.54 DRIVER PERSONALITY ENGINE
  // Personality changes local judgment/execution only.
  // It may never intentionally choose a slower macro route.
  // ============================================================
  function driverPersonality754(p){
    if(p?._personality754)return p._personality754;
    const ex=driverExecution720(p),id=identityOf(p);
    const style=p?.drivingStyle||{};
    const clamp=x=>Math.max(0,Math.min(1,x));
    const attackStyle=clamp(((Number(style.attack)||1)-.82)/.36);
    const safetyStyle=clamp(((Number(style.safety)||1)-.82)/.36);
    const wideStyle=id.control==="wide"?1:0;
    const r={
      // v7.50 persistent identity
      style:style.style||"balanced",
      // v7.51 aggression: narrow-gap commitment, never raw bonus speed
      aggression:clamp(ex.aggression*.72+attackStyle*.28),
      // v7.52 avoidance preference
      lateral:clamp(.66+ex.control*.12+ex.avoidance*.12+wideStyle*.10),
      thread:clamp(ex.aggression*.38+ex.prediction*.24+ex.control*.22+(1-wideStyle)*.16),
      brake:clamp(ex.braking*.55+ex.riskControl*.25+safetyStyle*.20),
      // v7.53 risk control
      caution:clamp(ex.riskControl*.56+ex.prediction*.20+ex.stability*.12+safetyStyle*.12),
      commitment:clamp(ex.aggression*.35+ex.control*.24+ex.focus*.18+(Number(id.commit)||1)*.12-.10),
      // v7.54 pressure/mental
      clutch:clamp(ex.pressure*.42+ex.focus*.25+ex.consistency*.20+ex.stability*.13),
      patience:clamp(ex.riskControl*.34+ex.consistency*.24+safetyStyle*.22+(Number(id.patience)||1)*.10-.10)
    };
    if(p)p._personality754=r;
    return r;
  }

  function stableEvadeSide754(st,kind,now){
    if(!/left|right/.test(kind||""))return;
    st.side754=/left/.test(kind)?-1:1;
    st.sideLockUntil754=now+285;
  }

  // ============================================================
  // v7.55 ~ v7.59 DRIVER PERSONALITY ENGINE FINAL
  // v7.55 clutch, v7.56 signatures, v7.57 rivalry,
  // v7.58 stats x personality authority, v7.59 final integration.
  // ============================================================
  function rivalContext759(p){
    if(!p||p.dead||p.done)return {rival:null,gap:99,ahead:false,intensity:0};
    const my=Number.isFinite(p._splineProg720)?p._splineProg720:0;
    let best=null,gap=99,ahead=false;
    for(const q of players){
      if(q===p||q.dead||q.done)continue;
      const qp=Number.isFinite(q._splineProg720)?q._splineProg720:0;
      const dg=Math.abs(qp-my);
      if(dg<gap){gap=dg;best=q;ahead=qp>my;}
    }
    const intensity=Math.max(0,Math.min(1,(2.25-gap)/2.25));
    return {rival:best,gap,ahead,intensity};
  }

  function clutchContext759(p){
    const pers=driverPersonality754(p),ex=driverExecution720(p);
    const prog=Number.isFinite(p?._splineProg720)?p._splineProg720:0;
    const total=Math.max(1,RACING_SPLINE_SEGS_720.total);
    const late=Math.max(0,Math.min(1,(prog/total-.70)/.30));
    const rv=rivalContext759(p);
    const load=Math.max(0,Math.min(1,rv.intensity*.66+late*.34));
    // v7.55: clutch does not boost raw pace. It only protects judgment/hand quality.
    const hold=Math.max(0,Math.min(1,
      pers.clutch*.56+ex.pressure*.18+ex.focus*.14+ex.consistency*.12));
    return {load,hold,rival:rv.rival,gap:rv.gap,ahead:rv.ahead,
      executionPenalty:load*(1-hold)*.42,
      judgmentPenalty:load*(1-hold)*.34};
  }

  function signatureProfile759(p){
    const style=p?.drivingStyle?.style||"balanced";
    const map={
      apexHunter:{label:"INSIDE APEX",side:.12,thread:.16,diag:.04,hard:.02,brake:-.02,rejoin:.10},
      safeReader:{label:"SAFE ARC",side:.18,thread:-.08,diag:.12,hard:-.05,brake:.10,rejoin:-.05},
      attacker:{label:"THREAD ATTACK",side:.04,thread:.24,diag:.12,hard:.05,brake:-.10,rejoin:.08},
      lineMaster:{label:"PERFECT LINE",side:.08,thread:.08,diag:.06,hard:-.04,brake:.02,rejoin:.14},
      balanced:{label:"ADAPTIVE",side:.08,thread:.06,diag:.08,hard:0,brake:0,rejoin:.04},
      controller:{label:"CONTROL CUT",side:.20,thread:.04,diag:.14,hard:-.02,brake:.02,rejoin:.02},
      patient:{label:"WAIT & CUT",side:.18,thread:-.06,diag:.10,hard:-.06,brake:.13,rejoin:-.04},
      opportunist:{label:"GAP HUNTER",side:.08,thread:.18,diag:.16,hard:.02,brake:-.06,rejoin:.08}
    };
    return map[style]||map.balanced;
  }

  function integratedDriver759(p){
    if(p?._integrated759)return p._integrated759;
    const ex=driverExecution720(p),pers=driverPersonality754(p),sig=signatureProfile759(p);
    // v7.58: personality authority is bounded by real execution skill.
    // A 30-stat racer cannot receive a large effective skill boost from a style label.
    const execution=ex.hand*.30+ex.judgment*.25+ex.survival*.20+ex.mental*.15+ex.line*.10;
    const personalityAuthority=.28+.50*execution; // 0.28~0.78, never full authority.
    const r={
      execution,personalityAuthority,
      aggression:ex.aggression*(1-personalityAuthority*.24)+pers.aggression*(personalityAuthority*.24),
      caution:ex.riskControl*(1-personalityAuthority*.27)+pers.caution*(personalityAuthority*.27),
      lateral:ex.control*(1-personalityAuthority*.22)+pers.lateral*(personalityAuthority*.22),
      thread:ex.prediction*(1-personalityAuthority*.20)+pers.thread*(personalityAuthority*.20),
      clutch:ex.mental*(1-personalityAuthority*.22)+pers.clutch*(personalityAuthority*.22),
      patience:ex.consistency*(1-personalityAuthority*.18)+pers.patience*(personalityAuthority*.18),
      signature:sig
    };
    if(p)p._integrated759=r;
    return r;
  }

  function personalitySummary759(p){
    const q=integratedDriver759(p),c=clutchContext759(p);
    return {
      style:p?.drivingStyle?.style||"balanced",
      signature:q.signature.label,
      aggression:q.aggression,caution:q.caution,lateral:q.lateral,thread:q.thread,
      clutch:q.clutch,personalityAuthority:q.personalityAuthority,
      rival:c.rival?.name||null,rivalGap:c.gap,pressureLoad:c.load
    };
  }

  function smoothDestinyWaypoints184(points){
    if(!Array.isArray(points)||points.length<3)return points||[];
    let cur=points.map(q=>[q[0],q[1]]);

    // Gentle Chaikin corner cutting. Endpoints stay fixed.
    // Two light passes round the racing line without inventing a shortcut.
    for(let pass=0;pass<2;pass++){
      const out=[[cur[0][0],cur[0][1]]];
      for(let i=0;i<cur.length-1;i++){
        const a=cur[i],b=cur[i+1];
        const q=[a[0]*.78+b[0]*.22,a[1]*.78+b[1]*.22];
        const r=[a[0]*.22+b[0]*.78,a[1]*.22+b[1]*.78];
        if(i>0)out.push(q);
        out.push(r);
      }
      out[out.length-1]=[cur[cur.length-1][0],cur[cur.length-1][1]];
      cur=out;
    }
    return cur;
  }

  function destinyPath813(p){
    const m=currentMap770();
    if(m.id!=='triple_diamond')return null;

    if(!Array.isArray(p._dgChoices813)||p._dgChoices813.length!==2){
      p._dgChoices813=[
        Math.random()<(m.routeChoiceProbability813??.5)?-1:1,
        Math.random()<(m.routeChoiceProbability813??.5)?-1:1
      ];
    }

    const topo=m.destinyTopology815;
    if(!topo)return null;
    const si=(Number.isInteger(p._dgStartIndex813)&&p._dgStartIndex813===1)?1:0;
    const signature=`${si}:${p._dgChoices813[0]}:${p._dgChoices813[1]}`;

    if(p._dgPathSig817===signature&&Array.isArray(p._dgPath813)&&p._dgSegs813?.length){
      return p._dgPath813;
    }

    m._destinyPathCache8181=m._destinyPathCache8181||Object.create(null);
    let cached=m._destinyPathCache8181[signature];

    if(!cached){
      const pts=[];
      const add=(arr,skipFirst=false)=>{
        if(!Array.isArray(arr))return;
        arr.forEach((q,i)=>{if(skipFirst&&i===0)return;pts.push([q[0],q[1]]);});
      };

      add(topo.startRoads[si]);
      add(topo.shared0,true);
      add(p._dgChoices813[0]<0?topo.branch1.left:topo.branch1.right,true);
      add(topo.shared1,true);
      add(p._dgChoices813[1]<0?topo.branch2.left:topo.branch2.right,true);
      add(topo.shared2,true);

      // v8.184: round hard waypoint corners first, then use moderate arc sampling.
      // This removes the visible "tiny stop / snap" at each polyline corner.
      const smoothPts=smoothDestinyWaypoints184(pts);
      const dense=densifyLine772(smoothPts,.60);
      const segs813=[];let total=0;
      for(let i=0;i<dense.length-1;i++){
        const a=dense[i],b=dense[i+1],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;
        segs813.push({a,b,dx,dy,L,ux:dx/L,uy:dy/L,start:total});
        total+=L;
      }
      segs813.total=total;
      cached={path:dense,segs:segs813,total};
      m._destinyPathCache8181[signature]=cached;
    }

    p._dgPath813=cached.path;
    p._dgSegs813=cached.segs;
    p._dgPathSig817=signature;
    p._dgProg813=Math.max(0,Math.min(cached.total,Number(p._dgProg813)||0));
    return p._dgPath813;
  }

  function destinyNearest813(p,x,y,hint=NaN){
    destinyPath813(p);
    const ss=p._dgSegs813||[];
    if(!ss.length)return 0;
    const total=Math.max(0,ss.total||0);

    // v8.18: once a racer owns a personal Destiny path, progress is monotonic.
    // Re-projecting by geometric "nearest" caused adjacent diamond legs to steal
    // authority near crossings and could send racers downward or onto the outer route.
    if(Number.isFinite(hint)){
      return Math.max(0,Math.min(total,hint));
    }

    // Only used for first initialization/recovery when no progress exists.
    let bestD=Infinity,bestP=0;
    for(const s of ss){
      const den=s.L*s.L||1;
      const t=Math.max(0,Math.min(1,((x-s.a[0])*s.dx+(y-s.a[1])*s.dy)/den));
      const qx=s.a[0]+s.dx*t,qy=s.a[1]+s.dy*t;
      const d=(x-qx)*(x-qx)+(y-qy)*(y-qy);
      if(d<bestD){bestD=d;bestP=s.start+s.L*t;}
    }
    return Math.max(0,Math.min(total,bestP));
  }
  function destinyPoint813(p,progress){
    destinyPath813(p);
    const ss=p._dgSegs813||[];
    if(!ss.length)return {x:p.x,y:p.y,ux:0,uy:-1};
    const pr=Math.max(0,Math.min(ss.total,Number(progress)||0));

    let lo=0,hi=ss.length-1,idx=hi;
    while(lo<=hi){
      const mid=(lo+hi)>>1,s=ss[mid];
      if(pr<=s.start+s.L){idx=mid;hi=mid-1;}
      else lo=mid+1;
    }
    const s=ss[idx];
    const t=Math.max(0,Math.min(1,(pr-s.start)/s.L));
    return {x:s.a[0]+s.dx*t,y:s.a[1]+s.dy*t,ux:s.ux,uy:s.uy,segIndex:idx};
  }

  function destinyMergeEase185(p,progress,total,targetOff){
    if(!p||!p._dgSegs813?.length)return targetOff;
    const frac=Math.max(0,Math.min(1,progress/Math.max(1,total)));

    // Three merge zones:
    // lower split merge, upper split merge, and final approach to GOAL.
    // Start recentering a little BEFORE each neck so there is no one-frame snap.
    const zones=[
      [.285,.335],  // first merge
      [.590,.645],  // second merge
      [.885,.955]   // final merge -> 12 o'clock GOAL
    ];

    let scale=1;
    for(const [a,b] of zones){
      if(frac>=a&&frac<=b){
        const t=(frac-a)/Math.max(.0001,b-a);
        // smoothstep 1 -> 0
        const s=t*t*(3-2*t);
        scale=Math.min(scale,1-s);
      }
    }
    return targetOff*scale;
  }

  function advanceDestinySafe818(p,distance,targetOff=0,mode="NORMAL"){
    if(!p||currentMap770().id!=='triple_diamond')return false;
    destinyPath813(p);
    const total=Math.max(0,p._dgSegs813?.total||0);
    if(!total)return false;

    const step=Math.max(0,Number(distance)||0);
    const old=Math.max(0,Math.min(total,Number(p._dgProg813)||0));
    const next=Math.min(total,old+step);
    const q=destinyPoint813(p,next);
    const nx=-q.uy,ny=q.ux;

    const maxLane=mode==="EVADE"?2.45:mode==="REJOIN"?1.55:2.05;
    if(mode!=="EVADE"&&p._raceState720)p._raceState720._dgEvadeLane182=NaN;

    // v8.185: start moving toward the center BEFORE a branch merge.
    const easedTarget=destinyMergeEase185(p,next,total,Number(targetOff)||0);
    const wanted=Math.max(-maxLane,Math.min(maxLane,easedTarget));
    const prev=Number(p._dgLaneOff818)||0;

    const frac185=next/Math.max(1,total);
    const nearMerge185=
      (frac185>.285&&frac185<.335)||
      (frac185>.590&&frac185<.645)||
      (frac185>.885&&frac185<.955);

    // Near merge points use an even smaller lateral step to remove the last tiny hitch.
    const rawDelta=wanted-prev;
    const baseDelta=Math.max(.030,Math.min(.078,(Number(distance)||0)*.22));
    const maxDelta=nearMerge185?Math.min(.046,baseDelta):baseDelta;
    const delta=Math.max(-maxDelta,Math.min(maxDelta,rawDelta));
    let lane=prev+delta;

    // Hard numeric corridor; no genericCourseMask scan every frame.
    lane=Math.max(-maxLane,Math.min(maxLane,lane));

    p.x=q.x+nx*lane;
    p.y=q.y+ny*lane;
    p._dgPrevProg815=old;
    p._dgProg813=next;
    p._dgLaneOff818=lane;
    p._lineOffset720=lane;

    const frac=next/Math.max(1,total);
    p._splineProg720=frac*Math.max(1,RACING_SPLINE_SEGS_720.total||1);
    p._splineFloor754=Math.max(Number(p._splineFloor754)||0,p._splineProg720);
    p.seg=Math.max(0,Math.min(segs.length-1,Math.floor(frac*Math.max(1,segs.length-1))));
    return true;
  }


  function enforceDestinyRoad817(p){
    if(!p||currentMap770().id!=='triple_diamond')return;
    destinyPath813(p);
    const total=Math.max(1,p._dgSegs813?.total||1);
    const prog=Math.max(0,Math.min(total,Number(p._dgProg813)||0));
    const q=destinyPoint813(p,prog);
    const nx=-q.uy,ny=q.ux;

    let lane=Number(p._dgLaneOff818);
    if(!Number.isFinite(lane))lane=Number(p._lineOffset720)||0;
    lane=Math.max(-2.65,Math.min(2.65,lane));

    p.x=q.x+nx*lane;
    p.y=q.y+ny*lane;
    p._dgLaneOff818=lane;
    p._lineOffset720=lane;
  }

  function syncDestinyProgress813(p){
    if(currentMap770().id!=='triple_diamond')return;
    destinyPath813(p);
    enforceDestinyRoad817(p);
    const total=Math.max(1,p._dgSegs813?.total||1);
    const prog=Math.max(0,Math.min(total,Number(p._dgProg813)||0));
    p._dgPrevProg815=prog;
    const frac=prog/total;
    p._splineProg720=frac*Math.max(1,RACING_SPLINE_SEGS_720.total||1);
    p._splineFloor754=Math.max(Number(p._splineFloor754)||0,p._splineProg720);
    p.seg=Math.max(0,Math.min(segs.length-1,Math.floor(frac*Math.max(1,segs.length-1))));
  }



  function nearestSplineProgress720(x,y){
    let bestD=Infinity,bestP=0;
    for(const s of RACING_SPLINE_SEGS_720){
      const t=Math.max(0,Math.min(1,((x-s.a[0])*s.dx+(y-s.a[1])*s.dy)/(s.L*s.L)));
      const qx=s.a[0]+s.dx*t,qy=s.a[1]+s.dy*t;
      const d=(x-qx)*(x-qx)+(y-qy)*(y-qy);
      if(d<bestD){bestD=d;bestP=s.start+s.L*t;}
    }
    return bestP;
  }

  function splineSegIndexAtProgress734(progress){
    const p=Math.max(0,Math.min(RACING_SPLINE_SEGS_720.total,Number(progress)||0));
    let lo=0,hi=RACING_SPLINE_SEGS_720.length-1;
    while(lo<hi){
      const mid=(lo+hi)>>1,s=RACING_SPLINE_SEGS_720[mid];
      if(p<=s.start+s.L)hi=mid;else lo=mid+1;
    }
    return lo;
  }

  function nearestSplineProgressLocal734(x,y,hint,span=24){
    if(!Number.isFinite(hint))return nearestSplineProgress720(x,y);
    const center=splineSegIndexAtProgress734(hint);
    let lo=Math.max(0,center-span),hi=Math.min(RACING_SPLINE_SEGS_720.length-1,center+span);
    let bestD=Infinity,bestP=hint,bestI=center;
    for(let i=lo;i<=hi;i++){
      const s=RACING_SPLINE_SEGS_720[i];
      const den=s.L*s.L||1;
      const t=Math.max(0,Math.min(1,((x-s.a[0])*s.dx+(y-s.a[1])*s.dy)/den));
      const qx=s.a[0]+s.dx*t,qy=s.a[1]+s.dy*t;
      const d=(x-qx)*(x-qx)+(y-qy)*(y-qy);
      if(d<bestD){bestD=d;bestP=s.start+s.L*t;bestI=i;}
    }
    // An evade is only a few units long. Boundary hit means the hint was stale;
    // do one wider local pass, never 390 segments per dodge candidate.
    if((bestI===lo||bestI===hi) && span<72)
      return nearestSplineProgressLocal734(x,y,bestP,72);
    return bestP;
  }

  function splineRawPoint724(progress){
    const p=Math.max(0,Math.min(RACING_SPLINE_SEGS_720.total,progress));
    let lo=0,hi=RACING_SPLINE_SEGS_720.length-1;
    while(lo<hi){
      const mid=(lo+hi)>>1;
      const s=RACING_SPLINE_SEGS_720[mid];
      if(p<=s.start+s.L)hi=mid;
      else lo=mid+1;
    }
    const s=RACING_SPLINE_SEGS_720[lo];
    const t=Math.max(0,Math.min(1,(p-s.start)/s.L));
    return {x:s.a[0]+s.dx*t,y:s.a[1]+s.dy*t,seg:lo};
  }

  function splinePointAt720(progress){
    const p=Math.max(0,Math.min(RACING_SPLINE_SEGS_720.total,progress));
    const q=splineRawPoint724(p);
    const e=.32;
    const a=splineRawPoint724(Math.max(0,p-e));
    const b=splineRawPoint724(Math.min(RACING_SPLINE_SEGS_720.total,p+e));
    const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1;
    return {x:q.x,y:q.y,ux:dx/L,uy:dy/L,seg:q.seg};
  }


  function roadClearance720(q,nx,ny,side){
    let d=0;
    for(let x=.18;x<=3.6;x+=.18){
      if(!visualRoadMask674(q.x+nx*side*x,q.y+ny*side*x,0)) break;
      d=x;
    }
    return d;
  }

  function executedSplinePoint720(p,progress){
    const q=splinePointAt720(progress);
    const nx=-q.uy,ny=q.ux;
    const plus=roadClearance720(q,nx,ny,1),minus=roadClearance720(q,nx,ny,-1);
    const wideSide=plus>=minus?1:-1;
    const ex=driverExecution720(p);

    // Everyone knows the same optimal line. Lower inside/control stats only create
    // a small wider execution miss — never a different macro route.
    const line739=ex.line;
    const miss=(1-line739)*.58;
    const variance739=(1-ex.consistency)*.13;
    const stable=.88+variance739*Math.sin(progress*.035+(p.index||0)*.73);
    const maxExecOff778=currentMap770().strictRoadFollow778?0:.70;
    let off=wideSide*Math.min(maxExecOff778,Math.max(0,miss*stable));

    // v7.31 local smoothing only:
    // reduce execution-offset authority through the two C1 transition curves so
    // the chosen road side cannot flip the rendered line at the junction.
    const sMap771=currentMap770().id==="s_map";
    const westEntry731=sMap771&&(q.x<56.0&&q.y>=62.2&&q.y<=66.1);
    const topTurn731=sMap771&&(q.x<58.0&&q.y>=31.4&&q.y<=35.2);
    if(westEntry731||topTurn731)off*=.20;

    // West climb now runs at x=51.10, leaving a little more visual rail clearance.
    if(sMap771&&q.y>=34.7&&q.y<=62.4&&q.x>50.6&&q.x<51.6){
      const xTry=q.x+nx*off;
      if(xTry>51.25){
        const denom=Math.abs(nx)<1e-6?1:nx;
        off=(51.25-q.x)/denom;
      }
    }
    // v7.56: signature is a tiny execution fingerprint, never a macro route.
    const mix759=integratedDriver759(p),sig759=mix759.signature;
    const sigRaw=((sig759.insideBias||0) + ((sig759.rejoin||0)*.10));
    const sigBias=Math.max(-.045,Math.min(.045,
      (sig759.label==="INSIDE APEX"?.035:
       sig759.label==="PERFECT LINE"?.020:
       sig759.label==="SAFE ARC"?-.018:
       sig759.label==="CONTROL CUT"?-.010:0) * mix759.personalityAuthority));
    off+=sigBias;

    // v7.84: Star Fish / Ice Crown already encode the final optimal lane in the
    // spline itself. Do not let per-driver fingerprints move that macro line.
    if(currentMap770().lockOptimalExecution784) off=0;

    // v7.89: a very small additional inside execution bias on real bends.
    // This applies even to the hand-tuned S-map, while staying far smaller than one road row.
    const turn789=mapTurn789(currentMap770(),Math.max(0,Math.min(segs.length-1,p.seg|0)));
    if(turn789.side&&turn789.power>.05){
      const localHalf789=Math.max(.55,(widths[Math.max(0,Math.min(widths.length-1,p.seg|0))]||8)*.5);
      off+=turn789.side*Math.min(.20,localHalf789*.032)*(.35+turn789.power*.65);
    }
    let x=q.x+nx*off,y=q.y+ny*off;
    if(visualRoadMask674(x,y,0) && courseContainsPoint(x,y,0))
      return {...q,x,y,executionOffset720:off};
    return {...q,executionOffset720:0};
  }



  function smoothSplineFrame116(progress){
    const total=Math.max(1,RACING_SPLINE_SEGS_720.total||1);
    const pr=Math.max(0,Math.min(total,Number(progress)||0));

    const q0=splinePointAt720(pr);
    const qb=splinePointAt720(Math.max(0,pr-.55));
    const qa=splinePointAt720(Math.min(total,pr+.55));

    let ux=(qb.ux||q0.ux||0)*.20+(q0.ux||0)*.60+(qa.ux||q0.ux||0)*.20;
    let uy=(qb.uy||q0.uy||-1)*.20+(q0.uy||-1)*.60+(qa.uy||q0.uy||-1)*.20;
    const L=Math.hypot(ux,uy)||1;
    ux/=L; uy/=L;

    return {x:q0.x,y:q0.y,ux,uy};
  }







  function splineDeviation720(p){
    if(currentMap770().id==='triple_diamond'){
      destinyPath813(p);
      const prog=destinyNearest813(p,p.x,p.y,p._dgProg813),q=destinyPoint813(p,prog);
      return Math.hypot(p.x-q.x,p.y-q.y);
    }
    const prog=nearestSplineProgressLocal734(p.x,p.y,p._splineProg720,28),q=splinePointAt720(prog);
    return Math.hypot(p.x-q.x,p.y-q.y);
  }


  function ensureRaceState720(p,now){
    if(!p._raceState720){
      p._raceState720={
        mode:"NORMAL",since:now,lastThreatAt:0,reactionReadyAt:0,
        pendingThreatId:-1,activeThreatId:-1,action:"none",target:null,actionUntil:0,rejoinUntil:0
      };
    }
    return p._raceState720;
  }


  // ============================================================
  // v7.22 REACTION & SURVIVAL HOTFIX
  // - Early corridor threat prediction
  // - Emergency proximity override
  // - Immediate backcon direction/speed response
  // ============================================================


  // ============================================================
  // v7.23 PERFORMANCE + BACKCON STABILITY
  // ============================================================

  function localObservers723(p,r=11.5){
    // Uses the existing spatial grid/cache instead of scanning all 100 observers.
    return playerNearbyObservers(p,r);
  }

  function localCandidateRisk723(p,target,obs){
    if(!target)return {risk:Infinity,nearest:0,blocked:true};
    let risk=0,nearest=999;
    for(const h of [.22,.52]){
      const frac=Math.max(0,Math.min(1,h/.52));
      const px=p.x+(target.x-p.x)*frac;
      const py=p.y+(target.y-p.y)*frac;
      for(const o of obs){
        const ovx=Number.isFinite(o.vx)?o.vx:0,ovy=Number.isFinite(o.vy)?o.vy:0;
        const d=Math.hypot(px-(o.x+ovx*h),py-(o.y+ovy*h));
        nearest=Math.min(nearest,d);
        if(d<3.85){const w=(3.85-d)/3.85;risk+=w*w;}
      }
    }
    return {risk,nearest,blocked:nearest<1.52};
  }

  function localFieldRisk723(target,obs){
    let risk=0,nearest=999;
    for(const o of obs){
      const ovx=Number.isFinite(o.vx)?o.vx:0;
      const ovy=Number.isFinite(o.vy)?o.vy:0;
      for(const h of [.22,.48]){
        const d=Math.hypot(target.x-(o.x+ovx*h),target.y-(o.y+ovy*h));
        nearest=Math.min(nearest,d);
        if(d<5.3){
          const w=(5.3-d)/5.3;
          risk+=w*w;
        }
      }
    }
    return {risk,nearest};
  }


  function destinyThreat182(p,now){
    if(!p||currentMap770().id!=='triple_diamond'||safeAt(p.x,p.y))return null;
    destinyPath813(p);

    const prog=Math.max(0,Number(p._dgProg813)||0);
    const frame=destinyPoint813(p,prog);
    const speed=Math.max(6.5,Number(p.speed)||9.72);
    const startBoost=startAiBoost816(p,now);

    // Emergency scan stays immediate but is limited to a small local bucket.
    const close=localObservers723(p,startBoost?7.0:5.8);
    for(const o of close){
      const rx=o.x-p.x,ry=o.y-p.y,dist=Math.hypot(rx,ry);
      const f=rx*frame.ux+ry*frame.uy;
      const l=rx*(-frame.uy)+ry*frame.ux;
      if(dist<(startBoost?3.20:2.85) ||
         (f>-.35&&f<(startBoost?6.2:5.0)&&Math.abs(l)<2.55)){
        return {o,t:.12,miss:dist,dist,rx,ry,forward:f,lateral:l,
          minSep:dist,minH:.12,frontBlock:true,emergency:true,source722:"destiny-close182"};
      }
    }

    // The generic AI used 10 candidate actions and global-spline prediction.
    // Destiny only needs a modest scan every ~55 ms because the route itself is fixed.
    if(now<(p._dgNextThreat182||0))return p._dgCachedThreat182||null;
    p._dgNextThreat182=now+(startBoost?32:58);

    let best=null,bestScore=Infinity;
    const nearby=localObservers723(p,startBoost?14.0:11.8);

    for(const o of nearby){
      const rx=o.x-p.x,ry=o.y-p.y;
      const dist=Math.hypot(rx,ry);
      const forward=rx*frame.ux+ry*frame.uy;
      const lateral=rx*(-frame.uy)+ry*frame.ux;

      // Ignore observers behind the racer or far across the opposite side.
      if(forward<-1.0||forward>10.5||Math.abs(lateral)>5.0)continue;

      const ovx=Number.isFinite(o.vx)?o.vx:0;
      const ovy=Number.isFinite(o.vy)?o.vy:0;

      let minSep=dist,minH=0;
      for(const h of [.26,.58]){
        const future=destinyPoint813(p,Math.min(p._dgSegs813.total,prog+speed*h));
        const d=Math.hypot(future.x-(o.x+ovx*h),future.y-(o.y+ovy*h));
        if(d<minSep){minSep=d;minH=h;}
      }

      const frontBlock=forward>-.20&&forward<5.25&&Math.abs(lateral)<2.20;
      const emergency=dist<2.70||(frontBlock&&dist<4.55)||(minSep<1.75&&minH<.44);
      const credible=emergency||(minSep<3.10&&dist<11.0);
      if(!credible)continue;

      const score=minSep*.85+dist*.04+minH*2.1-(emergency?2.0:0);
      if(score<bestScore){
        bestScore=score;
        best={o,t:minH||.45,miss:minSep,dist,rx,ry,forward,lateral,
          minSep,minH,frontBlock,emergency,source722:"destiny182"};
      }
    }

    p._dgCachedThreat182=best;
    return best;
  }

  function destinyLaneRisk182(p,frame,offset,nearby){
    const prog=Math.max(0,Number(p._dgProg813)||0);
    let minClear=99,risk=0;
    const speed=Math.max(6.5,Number(p.speed)||9.72);

    for(const h of [.22,.52]){
      const q=destinyPoint813(p,Math.min(p._dgSegs813.total,prog+speed*h));
      const nx=-q.uy,ny=q.ux;
      const x=q.x+nx*offset,y=q.y+ny*offset;
      for(const o of nearby){
        const ox=o.x+(Number(o.vx)||0)*h;
        const oy=o.y+(Number(o.vy)||0)*h;
        const d=Math.hypot(x-ox,y-oy);
        minClear=Math.min(minClear,d);
        if(d<4.2){
          const w=(4.2-d)/4.2;
          risk+=w*w*(1.1-h*.35);
        }
      }
    }
    return {risk,minClear};
  }

  function chooseDestinyEvade182(p,now,threat){
    destinyPath813(p);
    const prog=Math.max(0,Number(p._dgProg813)||0);
    const frame=destinyPoint813(p,prog);
    const nearby=localObservers723(p,8.4);
    const st=ensureRaceState720(p,now);

    // Only three legal choices: inside/current lane/other safe lane.
    // No backcon, stop, cross-road chord or global-spline candidate evaluation.
    const current=Math.max(-2.15,Math.min(2.15,Number(p._dgLaneOff818)||0));
    const opts=[-2.65,-1.8,0,1.8,2.65];

    let best=null;
    for(const off of opts){
      const r=destinyLaneRisk182(p,frame,off,nearby);
      let score=r.risk*14+Math.max(0,1.65-r.minClear)*12+Math.abs(off-current)*.14;

      // Short side lock prevents left-right panic oscillation.
      const side=Math.sign(off);
      if(side&&now<(st._dgSideLockUntil182||0)&&st._dgSide182&&side!==st._dgSide182)score+=5.0;

      // Prefer a slight inside bias when equally safe.
      score+=Math.abs(off)*.025;
      if(!best||score<best.score)best={off,score,minClear:r.minClear};
    }

    if(!best)best={off:0,score:0,minClear:9};
    const side=Math.sign(best.off);
    if(side){
      st._dgSide182=side;
      st._dgSideLockUntil182=now+(threat?.emergency?300:420);
    }

    const emergency=!!threat?.emergency;
    return {
      kind:"destiny-lane182",
      target:{x:frame.x,y:frame.y,kind:"race720-evade-destiny182"},
      laneOffset:best.off,
      speedMul:emergency?.92:.985,
      minClear:best.minClear
    };
  }


  function isSpaceMap107(){
    return currentMap770()?.id==="skyway";
  }


  function sparseObserverThreat107(p,now){
    // Special case for "only 1~2 observers nearby": this should be easy to read,
    // so do a cheap but proactive forward-lane check.
    const nearby=localObservers723(p,8.8);
    if(!nearby.length||nearby.length>3)return null;

    const frame=currentMap770().id==='triple_diamond'
      ? destinyPoint813(p,Math.max(0,Number(p._dgProg813)||0))
      : splinePointAt720(Number.isFinite(p._splineProg720)?p._splineProg720:nearestSplineProgress720(p.x,p.y));

    let best=null,bestScore=Infinity;
    for(const o of nearby){
      const rx=o.x-p.x,ry=o.y-p.y;
      const forward=rx*frame.ux+ry*frame.uy;
      const lateral=rx*(-frame.uy)+ry*frame.ux;
      const dist=Math.hypot(rx,ry);

      if(forward<-.35||forward>7.8||Math.abs(lateral)>3.0)continue;

      const score=forward*.65+Math.abs(lateral)*.4+dist*.15;
      if(score<bestScore){
        bestScore=score;
        best={o,dist,forward,lateral,emergency:dist<3.1||forward<3.4,source722:"sparse107"};
      }
    }
    return best;
  }


  function ensureAiPersonality109(p){
    if(!p)return {lane:0,risk:.5,variation:0};
    if(!p._aiPersonality109){
      const seed=((p.sourceIndex??p.index??0)+1)*1.731;
      const rnd=(n)=>((Math.sin(seed*n)*43758.5453)%1+1)%1;
      p._aiPersonality109={
        lane:(rnd(1)*2-1)*1.55,
        risk:.22+rnd(2)*.48,
        variation:.25+rnd(3)*.65,
        dodgeBias:rnd(4)<.5?-1:1,
        feintChance:.025+rnd(5)*.045
      };
    }
    return p._aiPersonality109;
  }





  function controlVariant112(p,now){
    const ai=ensureAiPersonality109(p);

    // Threat logic always cancels variants immediately.
    if(now<(p._survivalOverrideUntil109||0) || now<(p._hardDodgeUntil110||0)){
      p._variantMode112="none";
      p._variantUntil112=0;
      p._variantOffset112=0;
      return 0;
    }

    if(!p._variantMode112)p._variantMode112="none";

    if(now>=(p._variantUntil112||0)){
      p._variantMode112="none";
      p._variantOffset112=0;

      if(now<(p._nextVariantCheck115||0))return 0;
      p._nextVariantCheck115=now+250;

      // v1.1.5: same low-probability feel, but don't roll RNG every simulation tick.
      const roll=Math.random();
      if(roll<.085){
        const modes=["zigzag","wide","hold-left","hold-right","feint"];
        p._variantMode112=modes[Math.floor(Math.random()*modes.length)];
        p._variantUntil112=now+480+Math.random()*900;

        if(p._variantMode112==="wide")
          p._variantOffset112=(Math.random()<.5?-1:1)*(1.4+Math.random()*.9);
        else if(p._variantMode112==="hold-left")
          p._variantOffset112=-1.45-Math.random()*.55;
        else if(p._variantMode112==="hold-right")
          p._variantOffset112=1.45+Math.random()*.55;
        else if(p._variantMode112==="feint")
          p._variantOffset112=(Math.random()<.5?-1:1)*(1.2+Math.random()*.6);
      }
    }

    switch(p._variantMode112){
      case "zigzag":
        return Math.sin(now*.0072+(p.index||0)*1.9)*1.30;
      case "wide":
      case "hold-left":
      case "hold-right":
        return p._variantOffset112||0;
      case "feint":{
        const remain=Math.max(0,(p._variantUntil112||0)-now);
        const total=900;
        const phase=1-Math.min(1,remain/total);
        const sign=phase<.5?1:-.65;
        return (p._variantOffset112||0)*sign;
      }
      default:
        return 0;
    }
  }



  function hardCloseThreat110(p,now){
    if(!p||safeAt(p.x,p.y))return null;

    const prog=Number.isFinite(p._splineProg720)
      ? p._splineProg720
      : nearestSplineProgress720(p.x,p.y);
    const frame=splinePointAt720(prog);

    // Very cheap local scan, done every tick.
    const near=localObservers723(p,7.4);
    let best=null,bestScore=Infinity;

    for(const o of near){
      const rx=o.x-p.x,ry=o.y-p.y;
      const dist=Math.hypot(rx,ry);
      const forward=rx*frame.ux+ry*frame.uy;
      const lateral=rx*(-frame.uy)+ry*frame.ux;

      // Anything close and in/near the forward corridor is a guaranteed threat.
      const direct =
        dist<4.05 ||
        (forward>-.70&&forward<7.2&&Math.abs(lateral)<3.35);

      if(!direct)continue;

      const ovx=Number(o.vx)||0,ovy=Number(o.vy)||0;
      let minSep=dist,minH=0;
      for(const h of [.16,.38,.62]){
        const q=splinePointAt720(
          Math.min(RACING_SPLINE_SEGS_720.total,prog+Math.max(6.5,p.speed||9.7)*h)
        );
        const d=Math.hypot(q.x-(o.x+ovx*h),q.y-(o.y+ovy*h));
        if(d<minSep){minSep=d;minH=h;}
      }

      const score=minSep*.6+Math.max(0,forward)*.05+dist*.03;
      if(score<bestScore){
        bestScore=score;
        best={
          o,dist,forward,lateral,minSep,minH,
          frontBlock:true,
          emergency:true,
          sparse:near.length<=3,
          source722:"hard-close110"
        };
      }
    }
    return best;
  }

  function chooseHardCloseDodge110(p,now,threat){
    const prog=Number.isFinite(p._splineProg720)
      ? p._splineProg720
      : nearestSplineProgress720(p.x,p.y);

    const frame=splinePointAt720(prog);
    const nearby=localObservers723(p,9.8);

    // Wide candidate set. Survival has near-total priority over line efficiency.
    const candidates=[-4.0,-3.4,-2.7,-1.8,0,1.8,2.7,3.4,4.0];
    let best=null;

    for(const off of candidates){
      let risk=0,minClear=999;

      for(const h of [.10,.22,.38,.56,.78]){
        const q=splinePointAt720(
          Math.min(RACING_SPLINE_SEGS_720.total,prog+Math.max(6.5,p.speed||9.7)*h)
        );
        const nx=-q.uy,ny=q.ux;
        const x=q.x+nx*off,y=q.y+ny*off;

        for(const o of nearby){
          const ox=o.x+(Number(o.vx)||0)*h;
          const oy=o.y+(Number(o.vy)||0)*h;
          const d=Math.hypot(x-ox,y-oy);
          minClear=Math.min(minClear,d);
          if(d<5.8){
            const w=(5.8-d)/5.8;
            risk+=w*w*(1.45-h*.25);
          }
        }
      }

      // Almost no penalty for taking a wide line.
      let score=risk*34 + Math.max(0,3.0-minClear)*30 + Math.abs(off)*.010;

      // If the obstacle is on one side, strongly prefer the opposite side.
      const preferred = threat?.lateral>=0 ? -1 : 1;
      if(Math.sign(off)===preferred)score-=.42;

      // Break mirrored choices between the two racers.
      const ai112=ensureAiPersonality109(p);
      if(Math.sign(off)===ai112.dodgeBias)score-=.12;

      if(!best||score<best.score)best={off,score,minClear};
    }

    if(!best){
      const side=threat?.lateral>=0?-1:1;
      best={off:side*3.0,minClear:3.0,score:0};
    }

    return {
      kind:"hard-close-dodge110",
      laneOffset:best.off,
      speedMul:.78,
      minClear:best.minClear
    };
  }

  function survivalThreat109(p,now){
    if(!p||safeAt(p.x,p.y))return null;

    const prog=Number.isFinite(p._splineProg720)
      ? p._splineProg720
      : nearestSplineProgress720(p.x,p.y);
    const frame=splinePointAt720(prog);

    // Sparse situations should be EASY to read, not harder.
    const nearby=localObservers723(p,13.5);
    if(!nearby.length)return null;

    let best=null,bestScore=Infinity;
    for(const o of nearby){
      const rx=o.x-p.x,ry=o.y-p.y;
      const forward=rx*frame.ux+ry*frame.uy;
      const lateral=rx*(-frame.uy)+ry*frame.ux;
      const dist=Math.hypot(rx,ry);

      if(forward<-1.2||forward>11.2||Math.abs(lateral)>4.8)continue;

      const ovx=Number(o.vx)||0,ovy=Number(o.vy)||0;
      let minSep=dist,minH=0;
      for(const h of [.16,.34,.56,.82,1.08]){
        const q=splinePointAt720(Math.min(RACING_SPLINE_SEGS_720.total,prog+Math.max(6.5,p.speed||9.7)*h));
        const d=Math.hypot(q.x-(o.x+ovx*h),q.y-(o.y+ovy*h));
        if(d<minSep){minSep=d;minH=h;}
      }

      const sparse=nearby.length<=3;
      const front=forward>-.45&&forward<(sparse?8.5:6.8)&&Math.abs(lateral)<(sparse?3.3:2.8);
      const emergency=dist<(sparse?3.65:2.95) ||
        (front&&dist<(sparse?6.0:4.9)) ||
        (minSep<(sparse?2.45:1.95)&&minH<.58);

      const credible=emergency ||
        (minSep<(sparse?3.35:2.95)&&dist<(sparse?10.8:9.8));

      if(!credible)continue;

      const score=minSep*.72+dist*.04+Math.max(0,forward)*.035-(emergency?2.3:0)-(sparse?1.1:0);
      if(score<bestScore){
        bestScore=score;
        best={o,dist,forward,lateral,minSep,minH,frontBlock:front,emergency,
          sparse,source722:sparse?"survival-sparse109":"survival109"};
      }
    }
    return best;
  }

  function chooseSurvivalDodge109(p,now,threat){
    const ai=ensureAiPersonality109(p);
    const prog=Number.isFinite(p._splineProg720)
      ? p._splineProg720
      : nearestSplineProgress720(p.x,p.y);

    const nearby=localObservers723(p,9.5);
    const candidates=[-3.0,-2.2,-1.3,0,1.3,2.2,3.0];

    let best=null;
    for(const off of candidates){
      let risk=0,minClear=99;

      for(const h of [.18,.38,.62,.88]){
        const q=splinePointAt720(Math.min(RACING_SPLINE_SEGS_720.total,prog+Math.max(6.5,p.speed||9.7)*h));
        const nx=-q.uy,ny=q.ux;
        const x=q.x+nx*off,y=q.y+ny*off;

        for(const o of nearby){
          const ox=o.x+(Number(o.vx)||0)*h;
          const oy=o.y+(Number(o.vy)||0)*h;
          const d=Math.hypot(x-ox,y-oy);
          minClear=Math.min(minClear,d);
          if(d<5.2){
            const w=(5.2-d)/5.2;
            risk+=w*w*(1.25-h*.30);
          }
        }
      }

      // SURVIVAL > inside line.
      // Distance from center is a very small penalty compared with collision risk.
      let score=risk*20 + Math.max(0,2.2-minClear)*15 + Math.abs(off)*.035;

      // Different racers prefer different escape sides when both are safe.
      if(Math.sign(off)===ai.dodgeBias)score-=.10;
      score+=Math.abs(off-ai.lane)*.018;

      if(!best||score<best.score)best={off,score,minClear};
    }

    if(!best)best={off:ai.dodgeBias*2.4,score:0,minClear:3};

    return {
      kind:"survival-dodge109",
      laneOffset:best.off,
      speedMul:threat?.emergency?.90:.975,
      minClear:best.minClear
    };
  }

  function predictiveThreat722(p,now){
    if(currentMap770().id==='triple_diamond')return destinyThreat182(p,now);
    if(!p || safeAt(p.x,p.y)) return null;

    // v1.1.0: obvious nearby danger is deterministic, not probabilistic.
    const hard110=hardCloseThreat110(p,now);
    if(hard110)return hard110;

    const survival109=survivalThreat109(p,now);
    if(survival109)return survival109;

    const sparse107=sparseObserverThreat107(p,now);
    if(sparse107)return sparse107;

    const prog=Number.isFinite(p._splineProg720)
      ? p._splineProg720
      : nearestSplineProgress720(p.x,p.y);
    const frame=currentMap770().id==='triple_diamond'
      ? destinyPoint813(p,destinyNearest813(p,p.x,p.y,p._dgProg813))
      : splinePointAt720(prog);
    const pv=Math.max(6.5,Number(p.speed)||9.72);
    const pvx=frame.ux*pv,pvy=frame.uy*pv;

    // Cheap emergency pass every frame: only observers within 4.0.
    const startBoost816=startAiBoost816(p,now);
    const close=localObservers723(p,startBoost816?6.0:4.7);
    for(const o of close){
      const ox=o.x-p.x,oy=o.y-p.y,dist=Math.hypot(ox,oy);
      const forward=ox*frame.ux+oy*frame.uy;
      const lateral=ox*(-frame.uy)+oy*frame.ux;
      if(dist<(startBoost816?2.90:2.50) || (forward>-.30&&forward<(startBoost816?5.5:4.25)&&Math.abs(lateral)<(startBoost816?2.45:2.15))){
        return {
          o,t:.12,miss:dist,dist,rx:ox,ry:oy,forward,lateral,
          minSep:dist,minH:.12,frontBlock:true,emergency:true,
          source722:"close724"
        };
      }
    }

    // v7.24(130): normal prediction is capped at 11.1; emergency 4.0 stays immediate.
    if(now<(p._nextThreatScan724||0))
      return p._cachedThreat724||null;
    p._nextThreatScan724=now+(isSpaceMap107()?(startBoost816?24:34):(startBoost816?30:46));

    let best=null,bestScore=Infinity;
    const nearby=localObservers723(p,isSpaceMap107()?(startBoost816?16.5:14.6):(startBoost816?15.2:12.8));

    for(const o of nearby){
      const ox=o.x-p.x,oy=o.y-p.y;
      const dist=Math.hypot(ox,oy);
      const forward=ox*frame.ux+oy*frame.uy;
      const lateral=ox*(-frame.uy)+oy*frame.ux;
      const ovx=Number.isFinite(o.vx)?o.vx:0;
      const ovy=Number.isFinite(o.vy)?o.vy:0;
      const rvx=ovx-pvx,rvy=ovy-pvy;
      const vv=rvx*rvx+rvy*rvy;

      let t=9,miss=dist;
      if(vv>1e-7){
        t=Math.max(0,Math.min(.88,-(ox*rvx+oy*rvy)/vv));
        miss=Math.hypot(ox+rvx*t,oy+rvy*t);
      }

      let minSep=dist,minH=9;
      for(const h of [.20,.42,.68]){
        const pp=splinePointAt720(Math.min(RACING_SPLINE_SEGS_720.total,prog+pv*h));
        const d=Math.hypot(pp.x-(o.x+ovx*h),pp.y-(o.y+ovy*h));
        if(d<minSep){minSep=d;minH=h;}
      }

      const frontBlock=forward>-.30 && forward<(isSpaceMap107()?6.0:5.15) && Math.abs(lateral)<(isSpaceMap107()?2.45:2.20);
      const emergency=
        dist<2.55 ||
        (frontBlock && dist<4.15) ||
        (minSep<1.60 && minH<.34) ||
        (t<.19 && miss<2.02);

      const credible=
        emergency ||
        (minSep<2.90 && minH<.68 && dist<11.6) ||
        (t<.74 && miss<2.90 && dist<10.8);

      if(!credible)continue;

      const effectiveT=Math.min(t,minH);
      const effectiveMiss=Math.min(miss,minSep);
      const score=effectiveT*2.35+effectiveMiss*.78+dist*.032-(emergency?2.0:0);

      if(score<bestScore){
        bestScore=score;
        best={o,t:effectiveT,miss:effectiveMiss,dist,rx:ox,ry:oy,
          forward,lateral,minSep,minH,frontBlock,emergency,source722:"near724"};
      }
    }

    p._cachedThreat724=best;
    return best;
  }

  function readableThreat720(p,now){
    const raw=predictiveThreat722(p,now);
    if(!raw)return null;

    const ex=driverExecution720(p);
    const st=ensureRaceState720(p,now),id=raw.o?.id??-1;
    const eta=Math.min(raw.t,raw.minH??raw.t);

    if(raw.emergency){
      // v1.1.3: deterministic close danger is acted on immediately.
      // Driver stats still influence non-emergency prediction/technique.
      if(raw.source722==="hard-close110" || raw.dist<2.35){
        if(st.pendingThreatId!==id){st._detectedAt749=now;noteThreatRead749(p,now);}
        st.pendingThreatId=id;st.reactionReadyAt=now;return raw;
      }
      if(raw.dist<1.20){
        if(st.pendingThreatId!==id){st._detectedAt749=now;noteThreatRead749(p,now);}
        st.pendingThreatId=id;st.reactionReadyAt=now;return raw;
      }
      if(st.pendingThreatId!==id){
        st.pendingThreatId=id;
        st._detectedAt749=now;
        noteThreatRead749(p,now);
        const clutch759=clutchContext759(p);
        const emergencyDelay=6+(1-ex.reaction)*68+(1-ex.focus)*18+
          (1-ex.hand+clutch759.executionPenalty)*20;
        st.reactionReadyAt=now+emergencyDelay;
      }
      if(now<st.reactionReadyAt)return null;
      return raw;
    }

    // Detector stays capped at 11.1. Skill changes interpretation, not omniscience.
    const horizon=.38+ex.awareness*.68;
    const maxReadDist=7.20+ex.awareness*4.60;
    if(eta>horizon || raw.dist>maxReadDist)return null;

    const roundKey=(typeof currentRound==="number"?currentRound:0);
    const h=((p.index+1)*37+(id+3)*17+(roundKey+5)*13)%100/100;
    const readChance=.15+ex.awareness*.70+ex.mental*.12;
    if(h>readChance)return null;

    if(st.pendingThreatId!==id){
      st.pendingThreatId=id;
      st._detectedAt749=now;
      noteThreatRead749(p,now);
      const urgency=clamp01720((.52-eta)/.52);
      const clutch759=clutchContext759(p);
      const delay=(112-ex.reaction*76-ex.focus*18-
        Math.max(0,ex.hand-clutch759.executionPenalty)*10)*(1-urgency*.62);
      st.reactionReadyAt=now+Math.max(13,delay);
    }

    if(now<st.reactionReadyAt && eta>.19)return null;
    return raw;
  }

  function scoreEvadeCandidate720(p,c,kind,threat,obs723=null){
    if(!c||!courseContainsPoint(c.x,c.y,0)||!actualRoadChord719(p.x,p.y,c.x,c.y))
      return Infinity;

    const ex=driverExecution720(p),pers=driverPersonality754(p);
    const obs=obs723||localObservers723(p,8.6);
    const ch=localCandidateRisk723(p,c,obs);
    const field=localFieldRisk723(c,obs);
    const dev=Math.min(5,splineDeviationPoint720(c.x,c.y,p._splineProg720));
    const dist=Math.hypot(c.x-p.x,c.y-p.y);
    const critical=!!threat?.emergency&&!!threat?.frontBlock&&(threat?.dist??9)<3.25;

    let actionPenalty=0;
    if(/side/.test(kind))actionPenalty=-1.55-pers.lateral*.45;
    else if(/thread/.test(kind))actionPenalty=-1.12-pers.aggression*.34;
    else if(/diag/.test(kind))actionPenalty=-1.02-pers.lateral*.30;
    else if(/hard/.test(kind))actionPenalty=.30+(1-ex.control)*.38;
    else if(/brake/.test(kind))actionPenalty=1.18-pers.brake*.28;
    else if(/stop/.test(kind))actionPenalty=3.15;
    else if(/back/.test(kind))actionPenalty=critical?6.4:14.0;

    const riskWeight=13.0+ex.riskControl*8.5+ex.prediction*3.2;
    const gapWeight=10.5+ex.avoidance*7.5+ex.control*3.0+pers.caution*2.0;
    return ch.risk*riskWeight+field.risk*(5.2+ex.prediction*4.0)+
      Math.max(0,1.72-ch.nearest)*gapWeight+
      dev*(.50+(1-ex.inside)*.34)+dist*.08+actionPenalty;
  }

  function splineDeviationPoint720(x,y,hint=NaN){
    const prog=nearestSplineProgressLocal734(x,y,hint,18),q=splinePointAt720(prog);
    return Math.hypot(x-q.x,y-q.y);
  }

  function chooseEvadeAction720(p,now,threat){
    if(currentMap770().id==='triple_diamond')return chooseDestinyEvade182(p,now,threat);

    if(threat?.source722==="hard-close110"){
      return chooseHardCloseDodge110(p,now,threat);
    }

    if(threat?.source722==="survival109"||threat?.source722==="survival-sparse109"){
      return chooseSurvivalDodge109(p,now,threat);
    }

    // v1.0.7 compatibility path
    if(threat?.source722==="sparse107"){
      const oldProg=Number.isFinite(p._splineProg720)?p._splineProg720:nearestSplineProgress720(p.x,p.y);
      const q=splinePointAt720(Math.min(RACING_SPLINE_SEGS_720.total,oldProg+2.5));
      const side=threat.lateral>=0?-1:1;
      return {
        kind:"sparse-dodge107",
        target:{x:q.x,y:q.y,kind:"race720-sparse107"},
        laneOffset:side*2.0,
        speedMul:.97,
        minClear:3.0
      };
    }
    const oldProg=Number.isFinite(p._splineProg720)?p._splineProg720:0;
    const projected=currentMap770().id==='triple_diamond'
      ? destinyNearest813(p,p.x,p.y,p._dgProg813)
      : nearestSplineProgressLocal734(p.x,p.y,oldProg,28);
    const prog=Math.max(oldProg,projected);
    const frame=currentMap770().id==='triple_diamond'
      ? destinyPoint813(p,Math.min(p._dgSegs813?.total||0,projected))
      : splinePointAt720(prog);
    const nx=-frame.uy,ny=frame.ux,ex=driverExecution720(p);
    const pers=driverPersonality754(p),mix=integratedDriver759(p);
    const clutch759=clutchContext759(p),sig759=mix.signature;
    const st=ensureRaceState720(p,now);

    const unit769=unitChassis764(),fit769=unitCompatibility769(p);
    const chassisEvade769=unit769.evadeWidth*fit769.evadeMul;
    const lateralScale=(.94+mix.lateral*.13)*chassisEvade769;
    const threadLat=(1.00+(1-ex.avoidance)*.25)*lateralScale;
    const sideLat=(1.36+(1-ex.control)*.24)*lateralScale;
    const diagLat=(1.62+(1-ex.avoidance)*.30)*lateralScale;
    const hardLat=(2.15+(1-ex.avoidance)*.34)*lateralScale;
    const critical=!!threat?.emergency&&!!threat?.frontBlock&&(threat?.dist??9)<3.25;

    // v7.52: natural sideways/diagonal movement is the default visual language.
    const candidates=[
      ["side-left",1.55,-sideLat],["side-right",1.55,sideLat],
      ["thread-left",3.70,-threadLat],["thread-right",3.70,threadLat],
      ["diag-left",3.05,-diagLat],["diag-right",3.05,diagLat],
      ["hard-left",2.40,-hardLat],["hard-right",2.40,hardLat],
      ["brake",1.05,0],["stop",.28,0]
    ];

    const perceptionRadius734=5.6+ex.awareness*4.1;
    const obs723=localObservers723(p,perceptionRadius734);
    const ranked=[];

    function addCandidate(kind,f,l){
      const c={x:p.x+frame.ux*f+nx*l,y:p.y+frame.uy*f+ny*l,kind:"race720-evade-"+kind};
      let score=scoreEvadeCandidate720(p,c,kind,threat,obs723);
      if(!Number.isFinite(score))return;

      // Hold a chosen side briefly to eliminate left/right panic oscillation.
      const side=/left/.test(kind)?-1:/right/.test(kind)?1:0;
      if(side&&now<(st.sideLockUntil754||0)&&st.side754&&side!==st.side754)score+=2.9;

      // v7.56 signature + v7.57 rivalry + v7.58 bounded stats/personality mix.
      if(/thread/.test(kind))score+=(mix.caution-mix.aggression)*.72-(sig759.thread||0);
      if(/side/.test(kind))score-=mix.lateral*.66+mix.caution*.20+(sig759.side||0);
      if(/diag/.test(kind))score-=mix.lateral*.48+mix.thread*.18+(sig759.diag||0);
      if(/hard/.test(kind))score-=(sig759.hard||0);
      if(/brake/.test(kind))score-=pers.brake*.28+(sig759.brake||0);

      // Rivalry never creates a player collision detour. It only changes local
      // willingness to commit to a safe forward gap when a racer is close.
      if(clutch759.rival&&clutch759.gap<2.25){
        if(clutch759.ahead&&/thread|diag/.test(kind))
          score-=mix.aggression*.22*clutch759.load;
        if(!clutch759.ahead&&/side/.test(kind))
          score-=mix.caution*.10*clutch759.load;
      }
      ranked.push({kind,target:c,score,local:localCandidateRisk723(p,c,obs723)});
    }

    for(const [kind,f,l] of candidates)addCandidate(kind,f,l);

    // Backcon is a last-resort emergency only when every meaningful lateral
    // corridor is boxed. If one natural side escape exists, reverse is unavailable.
    const bodyGap769=(unit769.hitRadius-.48)*.72;
    const minGap=(1.45+mix.caution*.24+bodyGap769)*unit769.safetyGap;
    const maxRisk=1.85-mix.caution*.35;
    const safeLateral=ranked.some(r=>
      /side|thread|diag|hard/.test(r.kind)&&
      r.local.nearest>minGap&&r.local.risk<maxRisk
    );
    if(critical&&!safeLateral&&(threat?.dist??9)<2.20&&now>=(st.backCooldownUntil732||0)){
      addCandidate("back-left",-0.52,-0.44);
      addCandidate("back-right",-0.52,0.44);
      addCandidate("back",-0.62,0);
    }

    ranked.sort((a,b)=>a.score-b.score);
    if(!ranked.length)return null;

    const pressureLoad=clutch759.load;
    const judgment=Math.max(0,
      ex.judgment*.58+ex.survival*.20+ex.mental*.14+mix.caution*.08-
      clutch759.judgmentPenalty);
    const threatId=threat?.o?.id??0;
    const stable=((p.index+3)*29+(threatId+5)*11+(currentRound||0)*7)%100/100;
    const pressureError=clutch759.judgmentPenalty*.58;
    const mistakeChance=Math.max(.010,(1-judgment)*.54+pressureError);
    let pick=0;
    if(stable<mistakeChance&&ranked.length>1)pick=1;
    if(stable<mistakeChance*.18&&ranked.length>2)pick=2;

    const best=ranked[pick];
    const hand=Math.max(0,1-ex.hand+clutch759.executionPenalty*.45);
    if(hand>.03&&best&&!/back|stop/.test(best.kind)){
      const sign=(((p.index+1)*13+(threatId+1)*19)%2)?1:-1;
      const mag=hand*.54;
      const tx=best.target.x+nx*sign*mag;
      const ty=best.target.y+ny*sign*mag;
      if(courseContainsPoint(tx,ty,0)&&actualRoadChord719(p.x,p.y,tx,ty)){
        best.target={...best.target,x:tx,y:ty,kind:best.target.kind+"-exec754"};
      }
    }
    return best;
  }

  function startEvade720(p,now,threat){
    const st=ensureRaceState720(p,now);
    const choice=chooseEvadeAction720(p,now,threat);
      if(Number.isFinite(choice?.laneOffset)){
        const incomingLane114=choice.laneOffset;

        // v1.1.4: if an emergency dodge is already active, do not instantly
        // reverse direction on the next threat scan.
        if(
          threat?.source722==="hard-close110" &&
          now<(p._hardDodgeUntil110||0) &&
          Number.isFinite(p._hardDodgeLane110) &&
          Math.sign(incomingLane114)!==Math.sign(p._hardDodgeLane110)
        ){
          p.desiredOffset=p._hardDodgeLane110;
        }else{
          p.desiredOffset=incomingLane114;
        }
        p._survivalOverrideUntil109=now+(threat?.source722==="hard-close110"?1250:(threat?.emergency?900:620));
        if(threat?.source722==="hard-close110"){
          // v1.1.1: `choice` is the actual evade plan in this scope.
          // v1.1.0 incorrectly referenced undefined `plan` / `action`,
          // causing a ReferenceError and freezing the game loop.
          p._hardDodgeLane110=Number.isFinite(p.desiredOffset)
            ? p.desiredOffset
            : choice?.laneOffset;
          p._hardDodgeUntil110=now+1250;
        }
      }
    if(currentMap770().id==='triple_diamond'&&choice?.laneOffset!=null){
      st._dgEvadeLane182=choice.laneOffset;
    }

    st.mode="EVADE";st.since=now;st.lastThreatAt=now;
    st.activeThreatId=threat?.o?.id??-1;
    st.action=choice?.kind||"thread-left";
    st.target=choice?.target||normalTarget720(p);
    st.lastPlanAt723=now;

    const back=/back/.test(st.action);
    const stop=/stop|brake/.test(st.action);
    const thread=/thread|diag/.test(st.action);

    const ex739=driverExecution720(p),unit769=unitChassis764(),fit769=unitCompatibility769(p);
    const response769=unit769.evadeResponse*fit769.evadeMul;
    const execTime739=(1.12-ex739.hand*.18)/Math.max(.90,response769);
    st.actionUntil=now+(back?145:stop?205:thread?225:245)*execTime739;
    st.planHoldUntil723=now+(back?115:thread?185:175)*
      (1.08-ex739.stability*.12)/Math.max(.92,response769);
    st.rejoinUntil=0;
    stableEvadeSide754(st,st.action,now);

    if(back){
      const dx=st.target.x-p.x,dy=st.target.y-p.y,L=Math.hypot(dx,dy)||1;
      st.backDirX723=dx/L;st.backDirY723=dy/L;
      st.backOriginX732=p.x;st.backOriginY732=p.y;
      st.backMaxTravel732=/back-left|back-right/.test(st.action)?0.66:0.58;
      st.backCooldownUntil732=now+560;
      p.steerX=st.backDirX723;p.steerY=st.backDirY723;
      p.mouseTargetX=st.target.x;p.mouseTargetY=st.target.y;
      p.mouseMode="race720-backcon";
    }else{
      st.backDirX723=0;st.backDirY723=0;
    }
    return st;
  }
  function rejoinTarget720(p,now){
    if(currentMap770().id==='triple_diamond'){
      destinyPath813(p);
      const prog=Math.max(0,Number(p._dgProg813)||0);
      const q=destinyPoint813(p,Math.min(p._dgSegs813.total,prog+2.0));
      return {x:q.x,y:q.y,kind:"race720-rejoin-destiny818"};
    }
    const old=Number.isFinite(p._splineProg720)?p._splineProg720:nearestSplineProgress720(p.x,p.y);
    const prog=Math.max(old,Number(p._splineFloor754)||0);
    const look=currentMap770().optimizedSplineAuthority783?5.20:(currentMap770().strictRoadFollow778?2.35:8.0);
    const q=executedSplinePoint720(p,Math.min(RACING_SPLINE_SEGS_720.total,prog+look));
    return {x:q.x,y:q.y,kind:"race720-rejoin"};
  }



  function syncNormalEntryOffset759(p){
    if(!p)return;
    const prog=Number.isFinite(p._splineProg720)?p._splineProg720:
      nearestSplineProgress720(p.x,p.y);
    const q=splinePointAt720(prog),nx=-q.uy,ny=q.ux;
    const lateral=(p.x-q.x)*nx+(p.y-q.y)*ny;
    p._lineOffset720=Math.max(-.72,Math.min(.72,lateral));
    p._normalEntryAt759=gameNow();
  }

  function updateRaceState720(p,now){
    const st=ensureRaceState720(p,now);
    const threat=readableThreat720(p,now);

    // v7.32: one backcon can travel less than one logical road unit.
    // At the cap, immediately choose a different control (back candidates are
    // unavailable during cooldown), or rejoin if the danger has cleared.
    if(st.mode==="EVADE" && /back/.test(st.action||"") &&
       Number.isFinite(st.backOriginX732) && Number.isFinite(st.backOriginY732)){
      const travelled=Math.hypot(p.x-st.backOriginX732,p.y-st.backOriginY732);
      if(travelled>=(st.backMaxTravel732||.85) || now>=st.actionUntil){
        st.actionUntil=now;
        st.planHoldUntil723=now;
        if(threat){
          startEvade720(p,now,threat); // cooldown forces forward/diagonal/brake alternative
          return {st,threat};
        }
        st.mode="REJOIN";st.since=now;st.target=null;
        st.rejoinUntil=now+520+driverExecution720(p).recovery*180;
        return {st,threat:null};
      }
    }

    if(threat){
      st.lastThreatAt=now;
      const changedThreat=(st.activeThreatId??-1)!==(threat.o?.id??-1);

      if(st.mode!=="EVADE"){
        startEvade720(p,now,threat);
      }else if(changedThreat && now>=(st.planHoldUntil723||0)){
        startEvade720(p,now,threat);
      }else if(now>=st.actionUntil){
        startEvade720(p,now,threat);
      }
      return {st,threat};
    }

    if(st.mode==="EVADE" && now-st.lastThreatAt>105 && now>=st.actionUntil){
      st.mode="REJOIN";st.since=now;st.target=null;
      st.rejoinUntil=now+850+driverExecution720(p).recovery*350;
    }else if(st.mode==="REJOIN"){
      const dev=splineDeviation720(p);
      // v7.54: never jump onto the spline because a rejoin timer expired.
      if(dev<.34){
        st.mode="NORMAL";st.since=now;st.action="none";st.target=null;
        st._justRejoined=true;
        const old=Number.isFinite(p._splineProg720)?p._splineProg720:0;
        const projected=nearestSplineProgressLocal734(p.x,p.y,old,48);
        p._splineProg720=Math.max(old,Number(p._splineFloor754)||0,projected);
        p._splineFloor754=Math.max(Number(p._splineFloor754)||0,p._splineProg720);
        // v7.59: inherit the actual lateral offset at the REJOIN -> NORMAL handoff.
        // This removes the small one-frame pull toward a stale execution offset.
        syncNormalEntryOffset759(p);
      }else if(now>=st.rejoinUntil){
        const ex754=driverExecution720(p);
        st.rejoinUntil=now+360+ex754.recovery*180;
      }
    }
    if(st.mode==="NORMAL")st.pendingThreatId=-1;
    return {st,threat:null};
  }
  function normalTarget720(p){
    if(currentMap770().id==='triple_diamond'){
      destinyPath813(p);
      const prog=Math.max(0,Number(p._dgProg813)||0);
      const q=destinyPoint813(p,Math.min(p._dgSegs813.total,prog+2.15));
      return {x:q.x,y:q.y,kind:"race720-normal-destiny818"};
    }
    const old=Number.isFinite(p._splineProg720)?p._splineProg720:nearestSplineProgress720(p.x,p.y);
    const prog=Math.max(old,Number(p._splineFloor754)||0);
    const look=currentMap770().optimizedSplineAuthority783?5.20:(currentMap770().strictRoadFollow778?2.35:8.0);
    const q=executedSplinePoint720(p,Math.min(RACING_SPLINE_SEGS_720.total,prog+look));
    return {x:q.x,y:q.y,kind:"race720-normal"};
  }



  function strictLocalRoadTarget778(p,si,target){
    if(!target||!currentMap770().strictRoadFollow778||!segs.length)return target;
    // v7.891: route-centre guidance is advisory only; road edges are non-solid.
    if(currentMap770().edgePassThrough786) return target;
    const base=Math.max(0,Math.min(segs.length-1,si|0));
    const lo=Math.max(0,base-1),hi=Math.min(segs.length-1,base+2);
    let best=null,bestScore=Infinity;
    for(let j=lo;j<=hi;j++){
      const sg=segs[j];
      const dx=sg.b[0]-sg.a[0],dy=sg.b[1]-sg.a[1],L2=dx*dx+dy*dy||1;
      const u=Math.max(0,Math.min(1,((target.x-sg.a[0])*dx+(target.y-sg.a[1])*dy)/L2));
      const cx=sg.a[0]+dx*u,cy=sg.a[1]+dy*u;
      const lat=(target.x-cx)*sg.nx+(target.y-cy)*sg.ny;
      const half=Math.max(.72,(widths[Math.min(j,widths.length-1)]||6)*.5-.28);
      const laneLimit=Math.max(.62,half*.72);
      const clat=Math.max(-laneLimit,Math.min(laneLimit,lat));
      const x=cx+sg.nx*clat,y=cy+sg.ny*clat;
      const d=Math.hypot(target.x-x,target.y-y);
      const backPenalty=j<base?(base-j)*2.4:0;
      const aheadPenalty=j>base+1?(j-base-1)*.45:0;
      const score=d+backPenalty+aheadPenalty;
      if(score<bestScore){bestScore=score;best={...target,x,y,kind:(target.kind||"race720")+"-local-road778"};}
    }
    return best||target;
  }

  function raceEngine720(p,si,now){
    const {st,threat}=updateRaceState720(p,now);
    let t=null;
    if(st.mode==="NORMAL")t=normalTarget720(p);
    else if(st.mode==="EVADE")t=st.target;
    else t=rejoinTarget720(p,now);

    if(currentMap770().strictRoadFollow778){
      if(currentMap770().optimizedSplineAuthority783){
        // v7.83: do NOT project the optimal target back to the legacy center route.
        // Keep only the actual-road/chord validator as the safety authority.
        t=actualRoadTarget719(p,si,t)||actualRoadTarget719(p,si,normalTarget720(p))||normalTarget720(p);
      }else{
        t=strictLocalRoadTarget778(p,si,t)||normalTarget720(p);
        t=actualRoadTarget719(p,si,t)||strictLocalRoadTarget778(p,si,normalTarget720(p))||normalTarget720(p);
      }
    }else{
      t=actualRoadTarget719(p,si,t)||normalTarget720(p);
    }
    // v7.89: keep AI route choices out of exaggerated outside lanes.
    // EVADE may still use more of the road than NORMAL; edge rails remain pass-through.
    t=softLaneTarget789(p,t,st.mode);
    if(t)p._lastRaceTargetKind699=t.kind||"race720";
    p._raceMode720=st.mode;
    return t;
  }



  
  // v7.24 removed dead legacy AI: raceEngine1019


  
  // v7.24 removed dead legacy AI: raceEngine1000


  
  // v7.24 removed dead legacy AI: raceEngine999


  function raceAI769(p,si,now){
    return raceEngine720(p,si,now);
  }







  // ============================================================
  // v1.2.4 UNIFIED MOVEMENT ENGINE
  // One place owns player x/y. AI only supplies speed + target lane.
  // Legacy road recovery / teleport guards / rejoin projection do not touch
  // player coordinates while this engine is active.
  // ============================================================

  function statN120(p,key){
    const v=Number(p?.stats?.[key]);
    if(!Number.isFinite(v))return .5;
    return Math.max(0,Math.min(1,(v-70)/20));
  }

  function driver120(p){
    const reaction=statN120(p,"reaction");
    const prediction=statN120(p,"prediction");
    const avoidance=statN120(p,"avoidance");
    const control=statN120(p,"control");
    const stability=statN120(p,"stability");
    const cornering=statN120(p,"cornering");
    const braking=statN120(p,"braking");
    const inside=statN120(p,"insideLine");
    const route=statN120(p,"routeReading");
    const risk=statN120(p,"riskControl");
    const consistency=statN120(p,"consistency");
    const aggression=statN120(p,"aggression");
    const focus=statN120(p,"focus");
    return {reaction,prediction,avoidance,control,stability,cornering,braking,inside,route,risk,consistency,aggression,focus};
  }

  function ensurePersonality120(p){
    if(p._personality120)return p._personality120;
    const src=(p.sourceIndex??p.index??0)+1;
    const r=n=>((Math.sin(src*12.9898+n*78.233)*43758.5453)%1+1)%1;
    p._personality120={
      lane:(r(1)*2-1)*1.35,
      side:r(2)<.5?-1:1,
      wander:.28+r(3)*.55,
      variantRate:.024+r(4)*.026,
      phase:r(5)*Math.PI*2
    };
    return p._personality120;
  }

  function pathInfo120(p){
    if(currentMap770().id==="triple_diamond"){
      destinyPath813(p);
      const total=Math.max(1,p._dgSegs813?.total||1);
      let prog=Number.isFinite(p._v120Prog)?p._v120Prog:(Number(p._dgProg813)||0);
      prog=Math.max(0,Math.min(total,prog));
      return {
        destiny:true,total,prog,
        pointAt:(pr)=>destinyPoint813(p,Math.max(0,Math.min(total,pr)))
      };
    }

    const total=Math.max(1,RACING_SPLINE_SEGS_720.total||1);
    let prog=Number.isFinite(p._v120Prog)
      ? p._v120Prog
      : (Number.isFinite(p._splineProg720)?p._splineProg720:nearestSplineProgress720(p.x,p.y));
    prog=Math.max(0,Math.min(total,prog));
    return {
      destiny:false,total,prog,
      pointAt:(pr)=>splinePointAt720(Math.max(0,Math.min(total,pr)))
    };
  }
  function smoothFrame120(info,prog){
    const pr=Math.max(0,Math.min(info.total,Number(prog)||0));
    const d=.60;
    const q=info.pointAt(pr);
    const a=info.pointAt(Math.max(0,pr-d));
    const b=info.pointAt(Math.min(info.total,pr+d));

    // Keep exact path position monotonic.
    // Only direction is smoothed so corners remain continuous without position stalls.
    let ux=(q.x-a.x)*.48+(b.x-q.x)*.52;
    let uy=(q.y-a.y)*.48+(b.y-q.y)*.52;
    if(Math.hypot(ux,uy)<1e-6){
      ux=(b.ux||q.ux||0)+(a.ux||q.ux||0);
      uy=(b.uy||q.uy||-1)+(a.uy||q.uy||-1);
    }
    const L=Math.hypot(ux,uy)||1;
    return {x:q.x,y:q.y,ux:ux/L,uy:uy/L};
  }



  function roadHalf120(p,info,prog){
    if(info.destiny)return 2.85;
    const frac=Math.max(0,Math.min(1,prog/info.total));
    const si=Math.max(0,Math.min(widths.length-1,Math.floor(frac*Math.max(1,widths.length-1))));
    const raw=Math.max(4.6,Number(widths[si])||8);
    return Math.max(1.7,Math.min(2.85,raw*.27));
  }

  function curve120(info,prog){
    const a=smoothFrame120(info,prog);
    const b=smoothFrame120(info,Math.min(info.total,prog+.95));
    const dot=Math.max(-1,Math.min(1,a.ux*b.ux+a.uy*b.uy));
    return Math.acos(dot);
  }



  function sweptObserverHit120(p,o){
    const ax=Number(p.simPrevX??p.x), ay=Number(p.simPrevY??p.y);
    const bx=p.x, by=p.y;
    const cx=Number(o.simPrevX??o.x), cy=Number(o.simPrevY??o.y);
    const dx=o.x, dy=o.y;

    const r0x=ax-cx,r0y=ay-cy;
    const rvx=(bx-ax)-(dx-cx), rvy=(by-ay)-(dy-cy);
    const den=rvx*rvx+rvy*rvy;
    let t=den>1e-9?-(r0x*rvx+r0y*rvy)/den:0;
    t=Math.max(0,Math.min(1,t));
    const rx=r0x+rvx*t,ry=r0y+rvy*t;
    const r=playerHitRadius764(p)+.24;
    return rx*rx+ry*ry<=r*r;
  }



  function baseLane120(p,now,info,prog,maxLane){
    const d=driver120(p), per=ensurePersonality120(p);
    const frac=Math.max(0,Math.min(1,prog/info.total));
    const si=Math.max(0,Math.min(segs.length-1,Math.floor(frac*Math.max(1,segs.length-1))));

    let fast=0;
    try{ fast=Number(optimalRacingLine2Offset(p,si))||0; }catch(e){ fast=0; }

    // Stats determine line quality; identity keeps two racers from cloning each other.
    const lineSkill=(d.inside*.34+d.cornering*.22+d.route*.24+d.control*.20);
    // v1.7.1: racing line is only a weak reference. Driver identity/free space matter more.
    let target=fast*(.20+lineSkill*.16);
    target+=per.lane*(.48+(1-d.route)*.20);

    // Small continuous personal motion, not frame-random jitter.
    target+=Math.sin(now*.00085+per.phase)*maxLane*per.wander*.16;

    // On clear road, high inside-line skill can bias toward the calculated fast side.
    if(Math.abs(fast)>.05)target+=Math.sign(fast)*maxLane*d.inside*.025;

    return Math.max(-maxLane,Math.min(maxLane,target));
  }

  function isNeonDrift122(){
    const m=currentMap770();
    const id=(m?.id||"").toLowerCase();
    const nm=(m?.name||"").toLowerCase();
    return id==="neon_city"||id==="neon_drift"||nm.includes("네온");
  }

  function neonVerticalZone122(p,info,prog){
    if(!isNeonDrift122()||info.destiny)return false;

    // 9시 -> 11시 세로 구간.
    // 기존 맵 진행도 기준 대략 중후반 세로 상승 구간을 좌표로도 재확인.
    const q=info.pointAt(prog);
    const frac=prog/Math.max(1,info.total);

    // 좌측 세로축 / 상향 주행 영역만 제한.
    // 좌표 조건을 같이 사용해 다른 네온 구간에 영향 최소화.
    const leftVertical=(q.x<78 && q.y>18 && q.y<62);
    const progressBand=frac>.46&&frac<.72;
    return leftVertical||progressBand;
  }

  // ============================================================
  // v1.3.0 FREE DRIVING AI
  // Spline is only a forward reference. Racers plan local trajectories
  // across the usable road width and commit to them for short periods.
  // ============================================================

  function freeStyle130(p){
    if(p._freeStyle130)return p._freeStyle130;
    const d=driver120(p), per=ensurePersonality120(p);
    p._freeStyle130={
      survival:.58+d.risk*.24+d.prediction*.18,
      creativity:.20+per.wander*.42+d.route*.22,
      laneCommit:360+d.consistency*340,
      preferSide:per.side
    };
    return p._freeStyle130;
  }



  function maybeControlMove130(p,now,maxLane){
    const d=driver120(p), style=freeStyle130(p);

    if(now<(p._controlMoveUntil130||0)){
      const m=p._controlMove130;if(!m)return 0;
      const dur=Math.max(1,p._controlMoveUntil130-m.started);
      const t=Math.max(0,Math.min(1,(now-m.started)/dur));
      if(m.type==="zigzag")return Math.sin(t*Math.PI*2.35+m.phase)*maxLane*(.20+d.control*.12);
      if(m.type==="wide")return m.side*maxLane*(.44+d.control*.07);
      if(m.type==="hold")return m.side*maxLane*(.32+d.stability*.10);
      if(m.type==="feint")return m.side*(t<.46?1:-.74)*maxLane*(.25+d.control*.08);
      if(m.type==="cutback")return m.side*(t<.32?-1:1)*maxLane*(.20+d.reaction*.12);
      if(m.type==="doublemove"){
        const s=t<.28?1:(t<.58?-1:.72);
        return m.side*s*maxLane*(.22+d.control*.09);
      }
      if(m.type==="microzig"){
        return Math.sin(t*Math.PI*3.3+m.phase)*maxLane*(.12+d.control*.07);
      }
      return 0;
    }

    if(now<(p._nextControlCheck130||0))return 0;
    p._nextControlCheck130=now+210;

    // Slightly higher than v1.3.1, still clearly low-probability.
    // v1.6.2: slightly more human-like variation on safe road.
    const chance=.060+style.creativity*.040+d.control*.014;
    if(Math.random()>=chance)return 0;

    const types=[
      "zigzag","wide","hold",
      "feint","feint",
      "cutback","cutback",
      "doublemove","doublemove",
      "microzig"
    ];
    const type=types[Math.floor(Math.random()*types.length)];
    const side=Math.random()<.5?-1:1;
    p._controlMove130={type,side,started:now,phase:Math.random()*Math.PI*2};
    p._controlMoveUntil130=now+500+Math.random()*1050;
    return maybeControlMove130(p,now,maxLane);
  }




  function observerMotion131(o){
    const vx=Number(o.vx)||0,vy=Number(o.vy)||0;
    const moving=Math.hypot(vx,vy)>.04;

    // Observer movement cycle is 10 s moving -> 1 s stop.
    // Existing observer timers differ by generation, so read whichever timer is present.
    const stopUntil=Number(o.stopUntil??o.pauseUntil??o.restUntil??0)||0;
    const now=gameNow();
    const stopped=!moving || stopUntil>now;

    return {vx,vy,stopped,stopUntil};
  }



  function opponent132(p){
    if(players.length<2)return null;
    let best=null,bestGap=Infinity;
    const my=currentProgress(p);
    for(const q of players){
      if(q===p||q.done||q.dead)continue;
      const gap=Math.abs(currentProgress(q)-my);
      if(gap<bestGap){bestGap=gap;best=q;}
    }
    return best;
  }

  function competitionState132(p){
    const opp=opponent132(p);
    if(!opp)return {opp:null,gap:0,trailing:false,leading:false,close:false};

    const my=currentProgress(p), other=currentProgress(opp);
    const diff=other-my;
    return {
      opp,
      gap:Math.abs(diff),
      trailing:diff>0,
      leading:diff<0,
      close:Math.abs(diff)<4.2
    };
  }
  function antiMirrorLane132(p,baseLane,maxLane){
    const c=competitionState132(p);
    if(!c.opp)return baseLane;

    const otherLane=Number(c.opp._lane120)||0;
    const myLane=Number(p._lane120)||0;
    const laneGap=Math.abs(myLane-otherLane);
    const src=(p.sourceIndex??p.index??0);
    const personalSide=(src%2===0)?-1:1;

    // Close racing: force visibly different tactical choices.
    if(c.close){
      if(laneGap<1.05){
        const target=personalSide*maxLane*(.42+.16*driver120(p).route);
        return baseLane*.30+target*.70;
      }

      const oppSide=Math.sign(otherLane);
      if(oppSide!==0&&Math.sign(baseLane)===oppSide){
        return baseLane*.56+(-oppSide*maxLane*.38)*.44;
      }
    }

    // Even outside very close battles, keep a small persistent identity bias.
    return baseLane*.88 + personalSide*maxLane*.12;
  }


  function chaseMode132(p,info){
    const c=competitionState132(p);
    if(!c.opp||!c.trailing)return null;

    // "격차가 많이 벌어진" 상태: routeLength 기준 충분히 눈에 띄는 차이.
    const bigGap=Math.max(7.5,routeLength*.055);
    if(c.gap<bigGap)return null;

    const d=driver120(p);
    const frac=Math.max(0,Math.min(1,(Number(p._v120Prog)||info.prog)/Math.max(1,info.total)));
    const si=Math.max(0,Math.min(segs.length-1,Math.floor(frac*Math.max(1,segs.length-1))));
    let fast=0;
    try{fast=Number(optimalRacingLine2Offset(p,si))||0;}catch(e){fast=0;}

    // In chase mode, racing line / inside line dominates unless danger overrides later.
    const maxLane=roadHalf120(p,info,info.prog);
    const per=ensurePersonality120(p);
    let lane=Math.max(-maxLane,Math.min(maxLane,fast*.55+per.preferSide*maxLane*.25));

    if(Math.abs(lane)<.20){
      lane=per.preferSide*maxLane*.40;
    }

    return {
      active:true,
      lane,
      speedMul:1.025+d.cornering*.015+d.control*.010,
      gap:c.gap
    };
  }





  // ============================================================
  // v1.4.0 SURVIVAL MASTER
  // Objective: survive if a physically passable route exists.
  // ============================================================


  function evalPath150(p,info,startProg,lanes,times,nearby){
    const d=driver120(p), speed=Math.max(6.5,Number(p.speed)||9.7);
    let risk=0,minGap=999,blocked=0;

    for(let i=0;i<times.length;i++){
      const t=times[i];
      const seg=Math.min(lanes.length-1,Math.floor(i*lanes.length/times.length));
      const lane=lanes[seg];
      const pr=Math.min(info.total,startProg+speed*t);
      const q=smoothFrame120(info,pr),nx=-q.uy,ny=q.ux;
      const x=q.x+nx*lane,y=q.y+ny*lane;
      let blockedNow=false;

      for(const cs of nearby){
        const gap=Math.hypot(x-(cs.o.x+cs.vx*t),y-(cs.o.y+cs.vy*t));
        minGap=Math.min(minGap,gap);
        const safe=4.25+d.avoidance*.95+d.risk*.85+(cs.stopped?.85:0);
        if(gap<safe)blockedNow=true;
        if(gap<safe+2.6){
          const w=(safe+2.6-gap)/(safe+2.6);
          risk+=w*w*(2.85-t*.28);
        }
      }
      if(blockedNow)blocked++;
    }
    return {risk,minGap,blocked};
  }







  // ============================================================
  // v1.6.1 HUMAN SURVIVAL FLOW
  // Build a continuous safe corridor rather than solving threats one-by-one.
  // ============================================================




  function maybeSpecialControl197(p,now,info,maxLane){
    const sensor=immediateSensorCheck192(p,8.8);
    if(sensor.count===0)return null;
    if(sensor.nearest<6.0)return null;

    if(now<(p._specialControlUntil197||0) && p._specialControl197){
      return p._specialControl197;
    }

    const d=driver120(p);
    const creativity=(d.control*.45+d.route*.25+d.reaction*.15+d.consistency*.15);
    const chance=.006+creativity*.010;

    if(Math.random()>chance)return null;

    const r=Math.random();
    let type,duration,amp,speedMul=1;

    if(r<.30){
      type="zigzag";
      duration=760+Math.random()*220;
      amp=maxLane*(.28+.10*d.control);
    }else if(r<.50){
      type="backcontrol";
      duration=650+Math.random()*180;
      amp=maxLane*(.10+.04*d.control);
      speedMul=1;
    }else if(r<.67){
      type="spin360";
      duration=820+Math.random()*180;
      amp=maxLane*(.10+.04*d.control);
      speedMul=.93;
    }else if(r<.84){
      type="feint";
      duration=620+Math.random()*180;
      amp=maxLane*(.24+.08*d.control);
    }else{
      type="cutback";
      duration=680+Math.random()*180;
      amp=maxLane*(.28+.08*d.control);
    }

    const side=((p.sourceIndex??p.index??0)%2===0)?-1:1;
    const c={type,start:now,duration,amp,side,speedMul,completed:false,counted:false};
    p._specialControl197=c;
    p._specialControlUntil197=now+duration;

    // Attempt count only. Successful visible execution is counted later.
    if(gauntletMode190){
      gauntletAnalytics191.specialAttempts197=(gauntletAnalytics191.specialAttempts197||0)+1;
    }

    return c;
  }

  function specialControlLane197(p,now,base,maxLane){
    const c=p._specialControl197;
    if(!c){
      p._visualSpin197=0;
      p._reverseControl197=false;
      return {lane:base,speedMul:1,type:null,headingSpin:0,reverse:false};
    }

    const t=Math.max(0,Math.min(1,(now-c.start)/Math.max(1,c.duration)));

    if(t>=1){
      if(!c.counted){
        c.counted=true;
        c.completed=true;
        if(gauntletMode190){
          gauntletAnalytics191.specialControls197++;
          if(c.type==="zigzag")gauntletAnalytics191.zigzags++;
          if(c.type==="backcontrol")gauntletAnalytics191.backControls197++;
          if(c.type==="spin360")gauntletAnalytics191.spin360s197++;
        }
      }
      p._specialControl197=null;
      p._specialControlUntil197=0;
      return {lane:base,speedMul:1,type:null,headingSpin:0,reverse:false};
    }

    let off=0,speedMul=c.speedMul||1,headingSpin=0,reverse=false;

    if(c.type==="zigzag"){
      // 2.5 visible left-right cycles.
      off=Math.sin(t*Math.PI*5)*c.amp;
    }else if(c.type==="backcontrol"){
      // Real back-control: short reverse, then immediate forward recovery.
      if(t<.24){
        speedMul=-.34;
        reverse=true;
      }else if(t<.46){
        speedMul=1.03;
      }else{
        speedMul=1.00;
      }
      off=Math.sin(t*Math.PI)*c.amp*c.side;
    }else if(c.type==="spin360"){
      // Visual 360 heading rotation while mostly holding line.
      headingSpin=t*Math.PI*2;
      off=Math.sin(t*Math.PI*2)*c.amp;
      speedMul=.93;
    }else if(c.type==="feint"){
      off=(t<.42?1:-.75)*c.amp*c.side;
    }else if(c.type==="cutback"){
      if(t<.35)off=c.amp*c.side;
      else if(t<.72)off=-c.amp*c.side;
      else off=c.amp*.30*c.side;
    }

    return {
      lane:Math.max(-maxLane,Math.min(maxLane,base+off)),
      speedMul,
      type:c.type,
      headingSpin,
      reverse
    };
  }


  function freeDrivingDecision130(p,now,info){
    const prog=info.prog;
    const maxLane=roadHalf120(p,info,prog);

    // v1.7.2: calm-road planner only.
    // Survival decisions are centralized in unifiedSurvivalPlanner172.
    let lane=baseLane120(p,now,info,prog,maxLane);
    let speedMul=1;

    const chase=chaseMode132(p,info);
    if(chase?.active){
      lane=chase.lane;
      speedMul=chase.speedMul;
      p._controlMove130=null;p._controlMoveUntil130=0;
      p._specialControl197=null;p._specialControlUntil197=0;
    }else{
      lane+=maybeControlMove130(p,now,maxLane);
      lane=antiMirrorLane132(p,lane,maxLane);

      const special=maybeSpecialControl197(p,now,info,maxLane);
      if(special){
        const s=specialControlLane197(p,now,lane,maxLane);
        lane=s.lane;
        speedMul=s.speedMul;
        p._lastSpecialControl197=s.type;
        p._visualSpin197=s.headingSpin||0;
        p._reverseControl197=!!s.reverse;
      }else{
        p._visualSpin197=0;
        p._reverseControl197=false;
      }
    }

    if(neonVerticalZone122(p,info,prog)){
      lane=Math.max(-.82,Math.min(.34,lane));
    }

    return {
      lane:Math.max(-maxLane,Math.min(maxLane,lane)),
      speedMul,
      dangerous:false,
      risk:0,
      minGap:99
    };
  }








  // ============================================================
  // v1.8.1 DT-BASED LATERAL PHYSICS
  // Same real-world lateral motion whether simulated as 20ms x1 or 4ms x5.
  // ============================================================

  function lateralPhysics181(current,laneVelSec,wanted,control,turnSeverity,dtSec,boost=1){
    const maxRate=((.048+control*.046)*boost)/.020; // lane units / second
    const rawTarget=((wanted-current)*(.150+control*.100)*boost)/.020;
    const targetRate=Math.max(-maxRate,Math.min(maxRate,rawTarget));

    // Convert old per-20ms velocity increment to acceleration per second^2.
    const accelPerSec=((.0080+control*.0130)*(1+(boost-1)*.50))/.0004;
    const dv=Math.max(-accelPerSec*dtSec,Math.min(accelPerSec*dtSec,targetRate-laneVelSec));
    let vel=laneVelSec+dv;

    // Convert old per-tick damping to time-correct exponential damping.
    const dampBase=Math.min(.22,turnSeverity*(.14-control*.02));
    if(dampBase>0){
      vel*=Math.pow(Math.max(.01,1-dampBase),dtSec/.020);
    }

    return {
      vel,
      lane:current+vel*dtSec
    };
  }
  function movementStep120(p,now,dt,info,targetLane,speedMul){
    const d=driver120(p);
    const dtSafe=Math.max(0,Math.min(22,Number(dt)||0));
    const dtSec=dtSafe/1000;
    const prog=info.prog;
    const turn=curve120(info,prog);

    const cornerSkill=d.cornering*.38+d.control*.24+d.braking*.20+d.stability*.18;
    const turnSeverity=Math.min(1,turn/.72);
    const cornerMul=Math.max(.84,1-turnSeverity*(.12*(1-cornerSkill)+.025));

    const rawCommand=Number(speedMul);
    const commandedSpeed=Math.max(-.38,Math.min(1.03,Number.isFinite(rawCommand)?rawCommand:1));
    const rawStep=(p.speed||9.7)*commandedSpeed*cornerMul*dtSec;
    const step=Math.max(-.085,Math.min(.245,rawStep));
    const next=Math.max(0,Math.min(info.total,prog+step));

    // v1.48.0 — Three-Leaf Clover hard path authority.
    // The generic vehicle heading/inertia model can cut across nearby branches on
    // self-near clover geometry. On Clover, macro movement is therefore advanced
    // directly on the ordered spline. Observer avoidance may use only a very small
    // lateral offset; it can never select or drift onto another branch.
    if(currentMap770().id==="double_hairpin"){
      const frame=smoothFrame120(info,next);
      const nx=-frame.uy,ny=frame.ux;
      // v1.51.0: Clover uses the exact centre line. Rapidly changing avoidance
      // lane commands caused visible left/right trembling on the hard spline.
      const lane=0;
      p.x=frame.x;
      p.y=frame.y;
      p._headingUx121=frame.ux;p._headingUy121=frame.uy;
      p._lane120=lane;p._laneVelSec181=0;p._laneVel120=0;
      p._v120Prog=next;p._v120Total=info.total;
      p._splineProg720=next;p._splineFloor754=next;p._lineOffset720=lane;
      const frac=Math.max(0,Math.min(1,next/info.total));
      p.seg=Math.max(0,Math.min(segs.length-1,Math.floor(frac*Math.max(1,segs.length-1))));
      return {frac,step,turn};
    }

    const targetFrame=smoothFrame120(info,next);

    let ux=Number(p._headingUx121),uy=Number(p._headingUy121);
    if(!Number.isFinite(ux)||!Number.isFinite(uy)){
      ux=targetFrame.ux;uy=targetFrame.uy;
    }else{
      // heading blend is also time-corrected
      const baseTurn=.085+d.control*.030+d.stability*.022+d.cornering*.020;
      const turnBoost=Math.min(.06,turnSeverity*.045);
      const blend20=Math.min(.18,baseTurn+turnBoost);
      const blend=1-Math.pow(1-blend20,dtSafe/20);
      ux=ux*(1-blend)+targetFrame.ux*blend;
      uy=uy*(1-blend)+targetFrame.uy*blend;
      const HL=Math.hypot(ux,uy)||1;ux/=HL;uy/=HL;
    }
    p._headingUx121=ux;p._headingUy121=uy;

    const nx=-uy,ny=ux;

    const rawMax=roadHalf120(p,info,next);
    let maxLane=Number(p._maxLane121);
    if(!Number.isFinite(maxLane))maxLane=rawMax;

    // width filtering time-corrected
    const widthStep=.045*(dtSafe/20);
    maxLane+=Math.max(-widthStep,Math.min(widthStep,rawMax-maxLane));
    maxLane=Math.max(1.7,Math.min(3.2,maxLane));
    p._maxLane121=maxLane;

    let wanted=Math.max(-maxLane,Math.min(maxLane,Number(targetLane)||0));

    if(neonVerticalZone122(p,info,next)){
      const insideCap=Math.min(maxLane,.80);
      const outsideCap=Math.min(maxLane,.35);
      wanted=Math.max(-insideCap,Math.min(outsideCap,wanted));
      maxLane=Math.min(maxLane,1.05);
    }

    const current=Number.isFinite(p._lane120)?p._lane120:0;
    const control=d.control*.44+d.stability*.32+d.reaction*.12+d.consistency*.12;

    const emergencyBoost=
      (p.liveEvadeAction==="emergency-state")?4.55:
      ((p.liveEvadeAction==="execution-state")?4.05:
      ((p.liveEvadeAction==="special-control")?2.10:
      ((p.liveEvadeAction==="free-path-dodge")?1.50:1)));

    let laneVelSec=Number(p._laneVelSec181);
    if(!Number.isFinite(laneVelSec)){
      laneVelSec=(Number(p._laneVel120)||0)/.020;
    }

    const lateral=lateralPhysics181(
      current,laneVelSec,wanted,control,turnSeverity,dtSec,emergencyBoost
    );

    let lane=lateral.lane;
    laneVelSec=lateral.vel;
    lane=Math.max(-maxLane-.08,Math.min(maxLane+.08,lane));

    let x=p.x+ux*step;
    let y=p.y+uy*step;

    // Physical sideways movement now uses units/second * dt exactly once.
    const lateralMove=lane-current;
    x+=nx*lateralMove;
    y+=ny*lateralMove;

    const desiredX=targetFrame.x+nx*lane;
    const desiredY=targetFrame.y+ny*lane;
    const ex=desiredX-x,ey=desiredY-y;
    const err=Math.hypot(ex,ey);

    if(err>1e-6){
      const correctionCap=(.040+control*.018)*(dtSafe/20);
      const correction=Math.min(correctionCap,err*.12*(dtSafe/20));
      x+=ex/err*correction;
      y+=ey/err*correction;
    }

    const dx=x-p.x,dy=y-p.y;
    const moved=Math.hypot(dx,dy);
    const maxMove=.32*(dtSafe/20);
    if(moved>maxMove && maxMove>0){
      const k=maxMove/moved;
      x=p.x+dx*k;y=p.y+dy*k;
    }

    p.x=x;p.y=y;
    p._lane120=lane;
    p._laneVelSec181=laneVelSec;
    p._laneVel120=laneVelSec*.020; // legacy compatibility
    p._v120Prog=next;p._v120Total=info.total;

    if(info.destiny){
      p._dgProg813=next;p._dgLaneOff818=lane;
    }else{
      p._splineProg720=next;p._splineFloor754=next;p._lineOffset720=lane;
    }

    const frac=Math.max(0,Math.min(1,next/info.total));
    p.seg=Math.max(0,Math.min(segs.length-1,Math.floor(frac*Math.max(1,segs.length-1))));
    return {frac,step,turn};
  }




  function finishPlayer120(p,now,dt,frac){
    if(frac<.997)return false;
    p.done=true;
    if(gauntletMode190){gauntletStats190.clears++;finishGauntletAttempt191(now);}
    const preciseNow=now-Math.min(20,Math.max(0,dt))*.15;
    p.finishTime=Math.max(0,preciseNow-raceStart);
    registerFinishRecord(p,p.finishTime);
    const finished=players.filter(q=>q.done&&q.finishTime!=null).sort((a,b)=>a.finishTime-b.finishTime);
    if(finished.length===1)
      setBroadcastStory(`finish-${p.index}`,"FINISH",`${p.name} 1위 확정`,formatTime(p.finishTime),now,2400);
    return true;
  }

  function recordMovementTelemetry120(p,now,dt,frac){
    p.match.distance+=Math.hypot(p.x-p.match.lastX,p.y-p.match.lastY);
    p.match.lastX=p.x;p.match.lastY=p.y;

    if(now-(p.match.lastTraceAt||0)>=300){
      p.match.lastTraceAt=now;
      if(p.match.trace.length<220)p.match.trace.push([+p.x.toFixed(2),+p.y.toFixed(2)]);
    }

    if(!safeAt(p.x,p.y)&&!startProtectionActive816(p,now)){
      let nearestSq=Infinity;
      for(const o of playerNearbyObservers(p,3.3)){
        const dx=p.x-o.x,dy=p.y-o.y,d2=dx*dx+dy*dy;
        if(d2<nearestSq)nearestSq=d2;
      }
      if(nearestSq<10.89)p.match.dangerExposureMs+=dt;
      const r=playerHitRadius764(p)+.18,r2=r*r;
      if(nearestSq>r2&&nearestSq<1.35&&now-(p.match.lastNearMissAt||0)>420){
        p.match.nearMisses++;
        if(nearestSq<.44)p.match.extremeNearMisses++;
        p.match.lastNearMissAt=now;
      }
    }
  }

  function collideObservers120(p,now,frac){
    if(safeAt(p.x,p.y)||startProtectionActive816(p,now)||now<p.invUntil||now<p.collisionLockUntil)
      return false;

    const broad=playerHitRadius764(p)+1.35;
    for(const o of playerNearbyObservers(p,broad)){
      if(!sweptObserverHit120(p,o))continue;
      if(gauntletMode190){
        ensureTraceAnalytics1105();
        if(p._executionPlan1101){traceExecution1105(p,"PLAYER_DIED","collision",now);p._executionPlan1101=null;}
        if(p._aiState1102===AI_STATE_1102.EMERGENCY)gauntletAnalytics191.emergencyTrace1105.collided++;
        if(p._verifiedEscapePending1101){
          p._verifiedEscapePending1101=false;
          gauntletAnalytics191.chainedFail1100++;
        }
        const dbg=p._debugDecision190||{},actual=Math.hypot(p.x-o.x,p.y-o.y),nearCount=robustNearby192(p,8.0).length;
        const reason=classifyDeath191(p,dbg,actual,nearCount);
        gauntletStats190.deaths++;gauntletAnalytics191.avoidFail++;finishGauntletAttempt191(now);
        const w=gauntletAnalytics191.wave[gauntletWaveIndex190];if(w){w.attempts++;w.deaths++;}
        gauntletAnalytics191.reasons[reason]=(gauntletAnalytics191.reasons[reason]||0)+1;
        const row={
          wave:GAUNTLET_WAVES_190[gauntletWaveIndex190]||"-",
          reason,action:dbg.action||"unknown",lane:dbg.lane??"-",
          predMin:dbg.predMin??"-",sensorNearest:dbg.sensorNearest??"-",
          actual:+actual.toFixed(2),nearby:nearCount,
          progress:+(frac*100).toFixed(1),speedMul:dbg.speedMul??"-"
        };
        gauntletAnalytics191.deathLog.unshift(row);gauntletAnalytics191.deathLog=gauntletAnalytics191.deathLog.slice(0,20);
        gauntletStats190.lastDeath={name:p.name,action:row.action,lane:row.lane,predMin:row.predMin,actual:row.actual,progress:row.progress};
      }
      p.hits++;
      p.dead=true;
      p.match.collisions++;
      p.match.deathPoints.push({
        round:currentRound,
        t:Math.max(0,now-raceStart),
        progressPct:+(frac*100).toFixed(1),
        x:+p.x.toFixed(2),y:+p.y.toFixed(2),
        ...deathCauseSnapshot(p,now,o)
      });
      pushRaceEvent(`OBSERVER HIT · ${p.name}`,now,p.index,"COLLISION");
      addAutoHighlight("COLLISION",`${p.name} · 옵저버 충돌`,now,p.index,2);
      p.cleanConfidenceMs=0;p.cleanConfidence=0;
      p.continuousRunMs=0;p.continuousRunMul=1;
      return true;
    }
    return false;
  }

  // ============================================================
  // v1.5.3 FINAL COLLISION VETO
  // Every tick, validate the path that will ACTUALLY be driven.
  // If it intersects an observer soon, the old plan loses authority immediately.
  // ============================================================



  // ============================================================
  // v1.5.6 CROWD BREAKOUT
  // Dedicated response for 3+ simultaneous observers.
  // Chooses the largest open space instead of waiting for all routes to be "safe".
  // ============================================================




  // ============================================================
  // v1.7.0 ACTUAL MOTION PREDICTION
  // Predict the RACER'S reachable trajectory, not an instantly-snapped lane.
  // ============================================================

  function simulateReachablePath170(p,info,targetLane,speedMul,horizon,stepDt=.08){
    const d=driver120(p);
    const control=d.control*.44+d.stability*.32+d.reaction*.12+d.consistency*.12;

    let prog=Number(info.prog)||0;
    let lane=Number(p._lane120)||0;
    let latVel=Number(p._laneVel120)||0;

    const speed=Math.max(6.5,Number(p.speed)||9.7);
    const samples=[];

    for(let t=stepDt;t<=horizon+1e-6;t+=stepDt){
      const turn=curve120(info,prog);
      const turnSeverity=Math.min(1,turn/.72);
      const cornerSkill=d.cornering*.38+d.control*.24+d.braking*.20+d.stability*.18;
      const cornerMul=Math.max(.84,1-turnSeverity*(.12*(1-cornerSkill)+.025));

      const commanded=Math.max(0,Math.min(1.03,Number(speedMul)||0));
      const forwardStep=speed*commanded*cornerMul*stepDt;
      prog=Math.min(info.total,prog+forwardStep);

      const maxLane=roadHalf120(p,info,prog);
      const wanted=Math.max(-maxLane,Math.min(maxLane,Number(targetLane)||0));

      // Same family of lateral limits as real movementStep120.
      const boost=1.0;
      const maxLatSpeed=(.048+control*.046)*boost;
      const targetVel=Math.max(-maxLatSpeed,Math.min(maxLatSpeed,(wanted-lane)*(.150+control*.100)*boost));
      const accel=(.0080+control*.0130)*1.0;

      latVel+=Math.max(-accel,Math.min(accel,targetVel-latVel));
      latVel*=1-Math.min(.22,turnSeverity*(.14-d.stability*.04));
      lane+=latVel;

      lane=Math.max(-maxLane-.08,Math.min(maxLane+.08,lane));

      const q=smoothFrame120(info,prog);
      const nx=-q.uy,ny=q.ux;
      samples.push({
        t,
        prog,
        lane,
        x:q.x+nx*lane,
        y:q.y+ny*lane
      });
    }

    return samples;
  }







  // ============================================================
  // v1.6.3 THREAT BURST AI
  // Calm when road is clear; hyper-reactive only while observers are threatening.
  // ============================================================




  // ============================================================
  // v1.7.2 UNIFIED SURVIVAL PLANNER
  // One planner owns all danger decisions.
  // No SafeCorridor -> ThreatBurst -> Breakout -> Veto overwrites.
  // ============================================================

  function predictedObserver172(o,t){
    const m=observerMotion131(o);
    let vx=m.stopped?0:(Number(m.vx)||0);
    let vy=m.stopped?0:(Number(m.vy)||0);
    const physicalMax=Math.max(1,(Number(o.speed)||9.72*OBS_SPEED_RATIO)*1.18);
    const mag=Math.hypot(vx,vy);
    if(mag>physicalMax){
      const k=physicalMax/mag;
      vx*=k;vy*=k;
    }
    return {x:o.x+vx*t,y:o.y+vy*t,stopped:m.stopped,vx,vy};
  }
  function reachableTrajectory172(p,info,targetLane,speedMul,horizon=1.7,stepDt=.05){
    const d=driver120(p);
    const control=d.control*.44+d.stability*.32+d.reaction*.12+d.consistency*.12;

    let prog=Number(info.prog)||0;
    let lane=Number(p._lane120)||0;
    let laneVelSec=Number(p._laneVelSec181);
    if(!Number.isFinite(laneVelSec)){
      laneVelSec=(Number(p._laneVel120)||0)/.020;
    }

    const baseSpeed=Math.max(6.5,Number(p.speed)||9.7);
    const out=[];

    for(let t=stepDt;t<=horizon+1e-6;t+=stepDt){
      const turn=curve120(info,prog);
      const severity=Math.min(1,turn/.72);
      const cornerSkill=d.cornering*.38+d.control*.24+d.braking*.20+d.stability*.18;
      const cornerMul=Math.max(.84,1-severity*(.12*(1-cornerSkill)+.025));

      const cmd=Math.max(0,Math.min(1.03,Number(speedMul)||0));
      prog=Math.min(info.total,prog+baseSpeed*cmd*cornerMul*stepDt);

      const maxLane=roadHalf120(p,info,prog);
      const wanted=Math.max(-maxLane,Math.min(maxLane,Number(targetLane)||0));

      // Planner and real movement now use the exact same lateral dynamics.
      const lateral=lateralPhysics181(
        lane,laneVelSec,wanted,control,severity,stepDt,3.35
      );
      lane=lateral.lane;
      laneVelSec=lateral.vel;
      lane=Math.max(-maxLane-.08,Math.min(maxLane+.08,lane));

      const q=smoothFrame120(info,prog);
      const nx=-q.uy,ny=q.ux;
      out.push({
        t,prog,lane,
        x:q.x+nx*lane,
        y:q.y+ny*lane
      });
    }
    return out;
  }

  function trajectorySafety172(p,info,targetLane,speedMul,nearby,horizon=1.7){
    const d=driver120(p);
    const traj=reachableTrajectory172(p,info,targetLane,speedMul,horizon,.05);

    const hitR=playerHitRadius764(p)+.24;
    let minGap=999,hardHits=0,nearFrames=0,risk=0;

    for(const s of traj){
      let closeThis=false;

      for(const o of nearby){
        const po=predictedObserver172(o,s.t);
        const gap=Math.hypot(s.x-po.x,s.y-po.y);
        minGap=Math.min(minGap,gap);

        if(gap<=hitR+.28)hardHits++;

        const desired=
          hitR+
          3.05+
          d.avoidance*.88+
          d.risk*.74+
          (po.stopped?.72:0);

        if(gap<desired)closeThis=true;

        if(gap<desired+2.0){
          const w=(desired+2.0-gap)/(desired+2.0);
          risk+=w*w*(2.9-s.t*.40);
        }
      }

      if(closeThis)nearFrames++;
    }

    return {minGap,hardHits,nearFrames,risk};
  }


  function immediateSensorCheck192(p,radius=9.5){
    let nearest=999,count=0;
    const r2=radius*radius;
    for(const o of observers){
      const dx=o.x-p.x,dy=o.y-p.y,d2=dx*dx+dy*dy;
      if(d2>r2)continue;
      count++;
      nearest=Math.min(nearest,Math.sqrt(d2));
    }
    return {count,nearest};
  }

  function robustNearby192(p,radius){
    const out=[];
    const r2=radius*radius;
    for(const o of observers){
      const dx=o.x-p.x,dy=o.y-p.y;
      if(dx*dx+dy*dy<=r2)out.push(o);
    }
    return out;
  }


  // ============================================================
  // v1.9.3 EMERGENCY ESCAPE
  // When collision is imminent, ignore racing-line logic and escape the
  // collision circle as quickly as physically possible.
  // ============================================================

  function imminentThreat193(p,info){
    const d=driver120(p);
    const f=smoothFrame120(info,info.prog);
    const nx=-f.uy,ny=f.ux;
    let best=null;

    for(const o of robustNearby192(p,8.5)){
      const m=observerMotion131(o);
      const rx=o.x-p.x,ry=o.y-p.y;
      const fw=rx*f.ux+ry*f.uy;
      const lat=rx*nx+ry*ny;
      const dist=Math.hypot(rx,ry);

      // Relative closing speed along the current heading.
      const ovx=m.stopped?0:(Number(m.vx)||0);
      const ovy=m.stopped?0:(Number(m.vy)||0);
      const obsForward=ovx*f.ux+ovy*f.uy;
      const playerForward=(Number(p.speed)||9.7);
      const closing=Math.max(.1,playerForward-obsForward);

      const ttc=(fw>0)?fw/closing:0;
      const hitR=playerHitRadius764(p)+.35;

      const threatening=
        dist<hitR+3.1 ||
        (fw>-.5 && fw<6.5 && Math.abs(lat)<hitR+2.2 && ttc<.85);

      if(!threatening)continue;

      const urgency=
        (hitR+3.4-dist)*3.0 +
        Math.max(0,.9-ttc)*5.0 +
        Math.max(0,2.4-Math.abs(lat))*1.5;

      if(!best||urgency>best.urgency){
        best={o,m,dist,fw,lat,ttc,urgency,hitR};
      }
    }
    return best;
  }









  // ============================================================
  // v1.10.1 EXECUTION AI
  // Planner chooses a short A->B->C escape sequence.
  // Executor owns movement for a brief window unless safety materially changes.
  // ============================================================


  const AI_STATE_1102={
    NORMAL:"NORMAL",
    SPECIAL:"SPECIAL_CONTROL",
    SURVIVAL:"SURVIVAL_EXECUTION",
    EMERGENCY:"EMERGENCY"
  };

  function ensureAiState1102(p){
    if(!p._aiState1102)p._aiState1102=AI_STATE_1102.NORMAL;
    return p._aiState1102;
  }

  function setAiState1102(p,state,now){
    const prev=ensureAiState1102(p);
    if(prev===state)return false;
    p._aiState1102=state;
    p._aiStateSince1102=now;
    p._aiStateChanges1102=(p._aiStateChanges1102||0)+1;
    return true;
  }

  function clearEmergencyAction1102(p){
    p._emergencyAction1102=null;
    p._emergencyActionUntil1102=0;
  }



  function buildExecutionMicroDodge1107(p,now,info){
    if(!p._executionPlan1101)return null;

    const current=Number(p._lane120)||0;
    const maxLane=roadHalf120(p,info,info.prog);
    const nearby=robustNearby192(p,9.0);
    if(!nearby.length)return null;

    // v1.11.3 Micro-Dodge 2: immediate dodge + secondary collision screening.
    // In dense crowds a tiny one-step dodge is too fragile, so let the
    // existing Execution corridor own movement instead of fighting it.
    if(nearby.length>=4)return null;

    const offsets=[-.95,-.62,-.36,.36,.62,.95];
    const speeds=[.92,.97,1.00];
    const horizons=[.10,.18,.30,.46,.64];
    let best=null;

    for(const off of offsets){
      const lane=Math.max(-maxLane,Math.min(maxLane,current+off));
      for(const sm of speeds){
        let hardHits=0,risk=0,minGap=999,nearFrames=0,futureHits=0,futureRisk=0;

        for(const h of horizons){
          const s=trajectorySafety172(p,info,lane,sm,nearby,h);
          hardHits+=s.hardHits;
          risk+=s.risk;
          minGap=Math.min(minGap,s.minGap);
          nearFrames+=s.nearFrames;
          if(h>=.34){
            futureHits+=s.hardHits;
            futureRisk+=s.risk;
          }
        }

        const edgeRatio=Math.abs(lane)/Math.max(.001,maxLane);
        const moveCost=Math.abs(lane-current);
        const score=
          hardHits*60000+
          futureHits*90000+
          risk*145+
          futureRisk*220+
          nearFrames*42+
          Math.max(0,2.65-minGap)*135+
          edgeRatio*.35+
          moveCost*.20;

        if(!best||score<best.score){
          best={lane,speedMul:sm,minGap,hardHits,futureHits,score};
        }
      }
    }

    if(!best)return null;
    // Reject a dodge that merely postpones a predicted hard collision.
    if(best.futureHits>1)return null;
    return {lane:best.lane,speedMul:best.speedMul,minGap:best.minGap,hardHits:best.hardHits,until:now+76};
  }

  function runExecutionMicroDodge1107(p,now){
    const a=p._microDodge1107;
    if(!a)return null;
    if(now>=a.until){
      p._microDodge1107=null;
      p._microDodgeResumes1107=(p._microDodgeResumes1107||0)+1;
      return null;
    }
    return {
      lane:a.lane,
      speedMul:a.speedMul,
      dangerous:true,
      microDodge1107:true,
      execution1101:true,
      minGap:a.minGap,
      hardHits:a.hardHits
    };
  }


  function buildExecutionOverlayBridge1113(p,now,info){
    const plan=p._executionPlan1101;
    if(!plan)return null;
    const maxLane=roadHalf120(p,info,info.prog);
    const current=Number(p._lane120)||0;
    const phase=Math.max(0,Math.min((plan.points?.length||1)-1,plan.phase|0));
    const target=Number(plan.points?.[phase]);
    const baseLane=Number.isFinite(target)?target:current;
    const nearby=robustNearby192(p,9.0);
    if(!nearby.length)return null;

    const corrections=[-.55,-.30,-.15,0,.15,.30,.55];
    const speeds=[.94,.99,1.03];
    const horizons=[.10,.18,.28,.40];
    let best=null;

    for(const corr of corrections){
      const lane=Math.max(-maxLane,Math.min(maxLane,baseLane+corr));
      for(const sm of speeds){
        let hardHits=0,risk=0,nearFrames=0,minGap=999;
        for(const h of horizons){
          const s=trajectorySafety172(p,info,lane,sm,nearby,h);
          hardHits+=s.hardHits;risk+=s.risk;nearFrames+=s.nearFrames;minGap=Math.min(minGap,s.minGap);
        }
        const deviation=Math.abs(lane-baseLane);
        const edgeRatio=Math.abs(lane)/Math.max(.001,maxLane);
        const score=hardHits*72000+risk*175+nearFrames*50+Math.max(0,2.7-minGap)*140+deviation*2.2+edgeRatio*.40;
        if(!best||score<best.score)best={lane,speedMul:sm,minGap,hardHits,score};
      }
    }
    if(!best)return null;
    return {lane:best.lane,speedMul:best.speedMul,minGap:best.minGap,hardHits:best.hardHits,until:now+100};
  }


  let executionOverlaySeq1115=0;

  function startExecutionOverlayBridge1115(p,built){
    if(!p||!built)return false;
    const id=++executionOverlaySeq1115;
    built.overlayId1115=id;
    built.countedStart1115=true;
    p._executionOverlayBridge1113=built;
    p._executionOverlayBridges1113=(p._executionOverlayBridges1113||0)+1;
    p._lastExecutionOverlayId1115=id;
    if(gauntletMode190){
      gauntletAnalytics191.executionOverlayBridges1113=(gauntletAnalytics191.executionOverlayBridges1113||0)+1;
    }
    return true;
  }

  function runExecutionOverlayBridge1113(p,now){
    const a=p._executionOverlayBridge1113;
    if(!a)return null;
    if(now>=a.until){
      p._executionOverlayBridge1113=null;
      if(a.countedStart1115 && !a.countedResume1115){
        a.countedResume1115=true;
        p._executionOverlayResumes1113=(p._executionOverlayResumes1113||0)+1;
        if(gauntletMode190){
          gauntletAnalytics191.executionOverlayResumes1113=(gauntletAnalytics191.executionOverlayResumes1113||0)+1;
        }
      }
      return null;
    }
    return {lane:a.lane,speedMul:a.speedMul,dangerous:true,execution1101:true,executionOverlayBridge1113:true,minGap:a.minGap,hardHits:a.hardHits};
  }

  function buildEmergencyAction1102(p,now,info){
    const threat=imminentThreat193(p,info);
    if(!threat)return null;

    const current=Number(p._lane120)||0;
    const maxLane=roadHalf120(p,info,info.prog);

    const sides=[-1,1];
    const speeds=[.86,.96,1.03];
    let best=null;

    for(const side of sides){
      for(const sm of speeds){
        const push=threat.dist<threat.hitR+1.0?1.65:1.30;
        const lane=Math.max(-maxLane,Math.min(maxLane,current+side*push));
        const nearby=robustNearby192(p,9.0);
        const s=trajectorySafety172(p,info,lane,sm,nearby,.34);

        const edgeRatio=Math.abs(lane)/Math.max(.001,maxLane);
        const score=
          s.hardHits*50000+
          s.risk*180+
          s.nearFrames*55+
          Math.max(0,2.8-s.minGap)*140+
          edgeRatio*.35;

        if(!best||score<best.score){
          best={lane,speedMul:sm,minGap:s.minGap,hardHits:s.hardHits,score};
        }
      }
    }

    if(!best)return null;

    const duration=150;
    return {
      createdAt:now,
      until:now+duration,
      lane:best.lane,
      speedMul:best.speedMul,
      minGap:best.minGap,
      hardHits:best.hardHits
    };
  }


  function runEmergencyAction1102(p,now){
    const a=p._emergencyAction1102;
    if(!a)return null;
    if(now>=a.until){
      clearEmergencyAction1102(p);
      clearEmergencyTraceState1105(p);
      return null;
    }
    traceEmergencyApplied1105(p,now);
    return {
      lane:a.lane,
      speedMul:a.speedMul,
      dangerous:true,
      emergency1102:true,
      minGap:a.minGap,
      hardHits:a.hardHits
    };
  }

  function specialControlCanContinue1102(p,info){
    if(!p._specialControl197)return false;
    const nearby=robustNearby192(p,8.0);
    if(!nearby.length)return true;

    const lane=Number(p._lane120)||0;
    const check=trajectorySafety172(p,info,lane,1,nearby,.34);
    return check.hardHits===0 && check.minGap>=1.45;
  }


  let executionPlanSeq1105=0;

  function ensureTraceAnalytics1105(){
    if(!gauntletAnalytics191.executionLifecycle1105){
      gauntletAnalytics191.executionLifecycle1105={CREATED:0,COMPLETED:0,EMERGENCY_INTERRUPTED:0,STATE_INTERRUPTED:0,REPLACED:0,PLAYER_DIED:0,TIMEOUT:0,INVALIDATED:0};
    }
    if(!gauntletAnalytics191.executionTrace1105)gauntletAnalytics191.executionTrace1105=[];
    if(!gauntletAnalytics191.emergencyTrace1105){
      gauntletAnalytics191.emergencyTrace1105={detected:0,requested:0,entered:0,applied:0,collided:0,detectToEnterTotalMs:0,detectToEnterSamples:0,enterToApplyTotalMs:0,enterToApplySamples:0};
    }
  }

  function traceExecution1105(p,event,reason,now){
    ensureTraceAnalytics1105();
    const plan=p?._executionPlan1101;
    const id=plan?.planId1105 ?? p?._lastExecutionPlanId1105 ?? "-";
    const created=plan?.createdAt ?? p?._lastExecutionCreatedAt1105 ?? now;
    const phase=plan?.phase ?? p?._lastExecutionPhase1105 ?? "-";
    const elapsed=Math.max(0,now-created);
    if(gauntletMode190 && gauntletAnalytics191.executionLifecycle1105[event]!==undefined)gauntletAnalytics191.executionLifecycle1105[event]++;
    if(gauntletMode190 && event!=="CREATED"){
      gauntletAnalytics191.executionTrace1105.unshift({id,event,phase,elapsed:+elapsed.toFixed(0),reason:reason||"-",player:p?.name||"-",progress:+(((p?._v120Prog||0)/Math.max(1,p?._v120Total||1))*100).toFixed(1)});
      gauntletAnalytics191.executionTrace1105=gauntletAnalytics191.executionTrace1105.slice(0,20);
    }
    if(p){
      p._lastExecutionPlanId1105=id;
      p._lastExecutionCreatedAt1105=created;
      p._lastExecutionPhase1105=phase;
      p._lastExecutionTerminal1105=event;
    }
  }

  function terminateExecution1105(p,event,reason,now){
    if(!p?._executionPlan1101)return;
    traceExecution1105(p,event,reason,now);
    p._executionPlan1101=null;
  }

  function traceEmergencyDetected1105(p,now){
    ensureTraceAnalytics1105();
    if(!p._emergencyDetectedAt1105){
      p._emergencyDetectedAt1105=now;
      if(gauntletMode190)gauntletAnalytics191.emergencyTrace1105.detected++;
    }
  }
  function traceEmergencyRequested1105(p,now){
    ensureTraceAnalytics1105();
    p._emergencyRequestedAt1105=now;
    if(gauntletMode190)gauntletAnalytics191.emergencyTrace1105.requested++;
  }
  function traceEmergencyEntered1105(p,now){
    ensureTraceAnalytics1105();
    p._emergencyEnteredAt1105=now;
    if(gauntletMode190){
      const e=gauntletAnalytics191.emergencyTrace1105;
      e.entered++;
      if(p._emergencyDetectedAt1105){e.detectToEnterTotalMs+=Math.max(0,now-p._emergencyDetectedAt1105);e.detectToEnterSamples++;}
    }
  }
  function traceEmergencyApplied1105(p,now){
    ensureTraceAnalytics1105();
    if(p._emergencyAppliedAt1105)return;
    p._emergencyAppliedAt1105=now;
    if(gauntletMode190){
      const e=gauntletAnalytics191.emergencyTrace1105;
      e.applied++;
      if(p._emergencyEnteredAt1105){e.enterToApplyTotalMs+=Math.max(0,now-p._emergencyEnteredAt1105);e.enterToApplySamples++;}
    }
  }
  function clearEmergencyTraceState1105(p){
    p._emergencyDetectedAt1105=0;p._emergencyRequestedAt1105=0;p._emergencyEnteredAt1105=0;p._emergencyAppliedAt1105=0;
  }

  function executionThreatSignature1101(p,info){
    const f=smoothFrame120(info,info.prog);
    const nx=-f.uy,ny=f.ux;
    const obs=robustNearby192(p,9.5);
    let left=0,right=0,front=0,nearest=999;

    for(const o of obs){
      const rx=o.x-p.x,ry=o.y-p.y;
      const fw=rx*f.ux+ry*f.uy;
      const lat=rx*nx+ry*ny;
      const dist=Math.hypot(rx,ry);
      if(fw<-.8||fw>8.8||Math.abs(lat)>5.0)continue;

      nearest=Math.min(nearest,dist);
      const w=Math.max(0,(9.0-dist)/9.0);
      front+=w;
      if(lat<0)left+=w;
      else right+=w;
    }

    return {left,right,front,nearest,count:obs.length};
  }


  function buildExecutionPlan1101(p,now,info,corridor){
    if(!corridor)return null;

    const maxLane=roadHalf120(p,info,info.prog);
    const current=Number(p._lane120)||0;
    const target=Math.max(-maxLane,Math.min(maxLane,Number(corridor.lane)||0));
    const delta=target-current;

    const a=Math.max(-maxLane,Math.min(maxLane,current+delta*.48));
    const b=Math.max(-maxLane,Math.min(maxLane,current+delta*.80));

    let c=target;
    if(Math.abs(c)/Math.max(.001,maxLane)>.80){
      c=Math.sign(c)*maxLane*.74;
    }

    const threat=executionThreatSignature1101(p,info);

    // Per-stage timeout, not one global expiry.
    const density1110=threat.count;
    const stageTimeouts=[
      density1110>=5?220:(density1110>=3?185:155),
      density1110>=5?240:(density1110>=3?205:175),
      density1110>=5?260:(density1110>=3?225:190)
    ];

    const planId1105=++executionPlanSeq1105;
    const plan={
      planId1105,
      createdAt:now,
      phase:0,
      phaseStartedAt:now,
      points:[a,b,c],
      speed:[
        Math.max(.91,corridor.speedMul||.95),
        Math.max(.93,corridor.speedMul||.95),
        Math.max(.95,corridor.speedMul||.95)
      ],
      stageTimeouts,
      signature:threat,
      lastSafetyCheck:now,
      lastLane:current,
      completed:false,
      partialReplans:0
    };
    p._lastExecutionPlanId1105=planId1105;
    p._lastExecutionCreatedAt1105=now;
    p._lastExecutionPhase1105=0;
    if(gauntletMode190){ensureTraceAnalytics1105();gauntletAnalytics191.executionLifecycle1105.CREATED++;}
    return plan;
  }



  function executionSafetyChanged1101(p,info,plan,now){
    const sig=executionThreatSignature1101(p,info);
    const prev=plan.signature||{left:0,right:0,front:0,nearest:999,count:0};

    const sideFlip=
      (prev.left>prev.right*1.45 && sig.right>sig.left*1.75) ||
      (prev.right>prev.left*1.45 && sig.left>sig.right*1.75);

    const newCrowd=sig.count>=prev.count+4;
    const suddenNear=sig.nearest<1.45 && sig.nearest<prev.nearest-.85;

    plan.signature=sig;
    plan.lastSafetyCheck=now;

    if(suddenNear)return "FULL_SUDDEN_NEAR";
    if(sideFlip)return "PARTIAL_SIDE_FLIP";
    if(newCrowd)return "PARTIAL_CROWD_SPIKE";
    return "NONE";
  }



  function partialReplan1103(p,now,info,plan){
    const corridor=safeCorridor195(p,now,info);
    if(!corridor)return false;

    const current=Number(p._lane120)||0;
    const maxLane=roadHalf120(p,info,info.prog);
    let target=Math.max(-maxLane,Math.min(maxLane,Number(corridor.lane)||0));

    if(Math.abs(target)/Math.max(.001,maxLane)>.80){
      target=Math.sign(target)*maxLane*.74;
    }

    const phase=Math.max(0,Math.min(2,plan.phase|0));

    if(phase<=1){
      plan.points[1]=current+(target-current)*.60;
      plan.points[2]=target;
    }else{
      plan.points[2]=target;
    }

    plan.speed[phase]=Math.max(.92,corridor.speedMul||.95);
    if(phase<2)plan.speed[phase+1]=Math.max(.94,corridor.speedMul||.95);

    plan.phaseStartedAt=now;
    plan.partialReplans=(plan.partialReplans||0)+1;
    p._executionPartialReplans1103=(p._executionPartialReplans1103||0)+1;
    return true;
  }



  function executeEscapePlan1101(p,now,info){
    const plan=p._executionPlan1101;
    if(!plan)return null;

    if(plan.completed){
      traceExecution1105(p,"COMPLETED","already-completed",now);
      p._executionPlan1101=null;
      return null;
    }

    const change=executionSafetyChanged1101(p,info,plan,now);

    if(change==="FULL_SUDDEN_NEAR"){
      traceExecution1105(p,"INVALIDATED","sudden-near",now);
      p._executionPlan1101=null;
      p._executionReplans1101=(p._executionReplans1101||0)+1;
      p._executionFailed1104=(p._executionFailed1104||0)+1;
      p._executionInvalidSudden1108=(p._executionInvalidSudden1108||0)+1;
      return null;
    }

    if(change==="PARTIAL_SIDE_FLIP"){
      p._executionInvalidSideFlip1108=(p._executionInvalidSideFlip1108||0)+1;
      partialReplan1103(p,now,info,plan);
    }else if(change==="PARTIAL_CROWD_SPIKE"){
      p._executionInvalidCrowd1108=(p._executionInvalidCrowd1108||0)+1;
      partialReplan1103(p,now,info,plan);
    }

    let phase=Math.max(0,Math.min(plan.points.length-1,plan.phase|0));
    let target=plan.points[phase];
    const current=Number(p._lane120)||0;
    const dist=Math.abs(target-current);

    const reached=dist<.22;
    const timeout=Number(plan.stageTimeouts?.[phase])||170;
    const elapsed=now-(plan.phaseStartedAt||plan.createdAt);
    const timedOut=elapsed>=timeout;

    // v1.11.3: before a dense stage actually times out, try one cheap
    // partial replan so the unit can keep moving instead of expiring in place.
    if(!reached && !timedOut && elapsed>=timeout*.72 && (plan._stallAdjusted1110||0)<1){
      const sig1110=executionThreatSignature1101(p,info);
      if(sig1110.count>=3 && partialReplan1103(p,now,info,plan)){
        plan._stallAdjusted1110=(plan._stallAdjusted1110||0)+1;
        p._stallRescues1110=(p._stallRescues1110||0)+1;
      }
    }

    // Complete current stage either by real arrival or timeout.
    if(reached||timedOut){
      if(timedOut&&!reached)p._executionStageTimeouts1105=(p._executionStageTimeouts1105||0)+1;
      plan.phase++;
      p._lastExecutionPhase1105=plan.phase;
      plan.phaseStartedAt=now;

      // IMPORTANT: explicitly finish the plan here.
      if(plan.phase>=plan.points.length){
        if(timedOut&&!reached){
          traceExecution1105(p,"TIMEOUT","final-stage-timeout",now);
          p._executionTimedOut1108=(p._executionTimedOut1108||0)+1;
          p._executionPlan1101=null;
          p._executionJustFinished1104=now;
          return null;
        }
        plan.completed=true;
        traceExecution1105(p,"COMPLETED","lane-arrival",now);
        p._executionPlan1101=null;
        p._executionCompleted1101=(p._executionCompleted1101||0)+1;
        p._executionJustFinished1104=now;
        return null;
      }

      phase=plan.phase;
      target=plan.points[phase];
    }

    return {
      lane:target,
      speedMul:plan.speed[phase],
      dangerous:true,
      execution1101:true,
      minGap:2.5,
      hardHits:0,
      futureHardHits:0,
      phase1103:phase
    };
  }



  function startVerifiedEscape1101(p,now){
    p._verifiedEscapeStart1101=now;
    p._verifiedEscapeDeadline1101=now+1300;
    p._verifiedEscapePending1101=true;
  }

  function updateVerifiedEscape1101(p,now){
    if(!p._verifiedEscapePending1101)return;

    if(p.dead){
      p._verifiedEscapePending1101=false;
      if(gauntletMode190)gauntletAnalytics191.chainedFail1100++;
      return;
    }

    if(now>=p._verifiedEscapeDeadline1101){
      p._verifiedEscapePending1101=false;
      if(gauntletMode190)gauntletAnalytics191.chainedSuccess1100++;
    }
  }

  function safeCorridor195(p,now,info){
    const d=driver120(p);
    const maxLane=roadHalf120(p,info,info.prog);
    const current=Number(p._lane120)||0;

    let nearby=robustNearby192(p,14.0+d.prediction*1.9);
    if(!nearby.length)return null;

    nearby=nearby
      .map(o=>({o,dist:Math.hypot(o.x-p.x,o.y-p.y)}))
      .sort((a,b)=>a.dist-b.dist)
      .slice(0,14)
      .map(x=>x.o);

    const sensor=immediateSensorCheck192(p,10.0);
    if(sensor.count===0||sensor.nearest>8.2)return null;

    const denseThreat1108=sensor.count>=4;

    const speeds=[1.00,.95,.90];
    const centerFracs=[-.76,-.56,-.38,-.20,0,.20,.38,.56,.76];
    const edgeFracs=[-.94,.94];

    function evalNear(frac,sm,edgeEmergency=false){
      const lane=frac*maxLane;
      const near=trajectorySafety172(p,info,lane,sm,nearby,.70);
      const edgeRatio=Math.abs(lane)/Math.max(.001,maxLane);
      const reserve=Math.max(0,1-edgeRatio);

      let edgePenalty=0;
      if(edgeRatio>.72)edgePenalty+=(edgeRatio-.72)*5.2;
      if(edgeRatio>.82)edgePenalty+=1.6;
      if(edgeRatio>.90)edgePenalty+=2.8;
      if(edgeEmergency)edgePenalty+=2.0;

      const score=
        near.hardHits*(denseThreat1108?40000:32000)+
        near.risk*(denseThreat1108?195:165)+
        near.nearFrames*(denseThreat1108?54:44)+
        Math.max(0,(denseThreat1108?4.8:4.3)-near.minGap)*(denseThreat1108?132:110)+
        Math.abs(lane-current)*.018+
        (1-sm)*.010+
        edgePenalty-
        reserve*(denseThreat1108?1.30:1.0);

      return {lane,speedMul:sm,near,score,reserve,edgeRatio,edgeEmergency};
    }

    const stage1=[];
    for(const frac of centerFracs){
      for(const sm of speeds){
        stage1.push(evalNear(frac,sm,false));
      }
    }
    stage1.sort((a,b)=>a.score-b.score);

    const bestCenter=stage1[0];
    const unlockEdge=!bestCenter||bestCenter.near.hardHits>0||bestCenter.near.minGap<1.60;

    if(unlockEdge){
      for(const frac of edgeFracs){
        for(const sm of speeds){
          stage1.push(evalNear(frac,sm,true));
        }
      }
      stage1.sort((a,b)=>a.score-b.score);
    }

    // Chained survival: only top candidates get deeper continuation scoring.
    const finalists=stage1.slice(0,5);
    let best=null;

    for(const c of finalists){
      const mid=trajectorySafety172(p,info,c.lane,c.speedMul,nearby,1.18);
      const far=trajectorySafety172(p,info,c.lane,c.speedMul,nearby,1.72);

      // future escape options: can we still move left/right after first dodge?
      const sideStep=maxLane*.34;
      const leftLane=Math.max(-maxLane,Math.min(maxLane,c.lane-sideStep));
      const rightLane=Math.max(-maxLane,Math.min(maxLane,c.lane+sideStep));

      const leftFuture=trajectorySafety172(p,info,leftLane,Math.max(.90,c.speedMul),nearby,1.40);
      const rightFuture=trajectorySafety172(p,info,rightLane,Math.max(.90,c.speedMul),nearby,1.40);

      const futureOptions=
        (leftFuture.hardHits===0?1:0)+
        (rightFuture.hardHits===0?1:0);

      const futureBestGap=Math.max(leftFuture.minGap,rightFuture.minGap);

      let score=
        c.score+
        mid.hardHits*(denseThreat1108?23000:17000)+
        far.hardHits*(denseThreat1108?17000:12000)+
        mid.risk*(denseThreat1108?102:82)+
        far.risk*(denseThreat1108?68:54)+
        mid.nearFrames*(denseThreat1108?26:20)+
        far.nearFrames*(denseThreat1108?17:13)+
        Math.max(0,(denseThreat1108?4.2:3.7)-mid.minGap)*(denseThreat1108?68:52)+
        Math.max(0,(denseThreat1108?3.6:3.2)-far.minGap)*(denseThreat1108?46:34)-
        c.reserve*(denseThreat1108?1.25:.9)-
        futureOptions*(denseThreat1108?2.7:1.9)-
        Math.min(2.5,futureBestGap)*(denseThreat1108?.24:.18);

      if(c.edgeRatio>.80)score+=1.2;
      if(c.edgeEmergency)score+=.9;

      if(!best||score<best.score){
        best={
          lane:c.lane,
          speedMul:c.speedMul,
          score,
          hardHits:c.near.hardHits,
          futureHardHits:mid.hardHits+far.hardHits,
          minGap:c.near.minGap,
          futureMinGap:Math.min(mid.minGap,far.minGap),
          risk:c.near.risk,
          reserve:c.reserve,
          edgeRatio:c.edgeRatio,
          edgeEmergency:c.edgeEmergency,
          futureOptions
        };
      }
    }

    if(!best)return null;

    const prev=Number(p._safeCorridorLane195);
    if(Number.isFinite(prev)&&Math.abs(prev-best.lane)>.52){
      p._safeCorridorSwitches195=(p._safeCorridorSwitches195||0)+1;
    }

    // continuity only if previous path is still safe and leaves at least some gap
    if(Number.isFinite(prev)&&Math.abs(prev-best.lane)>.78){
      const prevEval=trajectorySafety172(p,info,prev,best.speedMul,nearby,.50);
      if(prevEval.hardHits===0&&prevEval.minGap>2.55){
        best.lane=prev*.58+best.lane*.42;
      }
    }

    p._safeCorridorLane195=best.lane;
    p._safeCorridorUntil195=now+70;

    return {
      lane:best.lane,
      speedMul:best.speedMul,
      dangerous:true,
      corridor195:true,
      minGap:best.minGap,
      futureMinGap:best.futureMinGap,
      hardHits:best.hardHits,
      futureHardHits:best.futureHardHits,
      futureOptions:best.futureOptions,
      risk:best.risk,
      reserve:best.reserve,
      edgeRatio:best.edgeRatio,
      edgeEmergency:best.edgeEmergency
    };
  }





  function emergencyTtc195(p,info){
    const threat=imminentThreat193(p,info);
    if(!threat)return Infinity;
    return Number.isFinite(threat.ttc)?threat.ttc:Infinity;
  }





  function unifiedSurvivalPlanner172(p,now,info){
    const d=driver120(p);
    const maxLane=roadHalf120(p,info,info.prog);

    let nearby=robustNearby192(p,13.5+d.prediction*2.4);
    if(!nearby.length)return null;

    nearby=nearby
      .map(o=>({o,dist:Math.hypot(o.x-p.x,o.y-p.y)}))
      .sort((a,b)=>a.dist-b.dist)
      .slice(0,16)
      .map(x=>x.o);

    const currentLane=Number(p._lane120)||0;
    const currentSpeed=.98;

    const currentSafety=trajectorySafety172(p,info,currentLane,currentSpeed,nearby,1.25);

    const rawSensor192=immediateSensorCheck192(p,9.5);

    if(
      currentSafety.hardHits===0 &&
      currentSafety.nearFrames===0 &&
      currentSafety.minGap>4.5 &&
      currentSafety.risk<.03 &&
      !(rawSensor192.count>0 && rawSensor192.nearest<6.0)
    ){
      return null;
    }

    if(rawSensor192.count>0 && rawSensor192.nearest<6.0 && currentSafety.minGap>20){
      currentSafety.minGap=rawSensor192.nearest;
      currentSafety.risk=Math.max(currentSafety.risk,.45);
      currentSafety.nearFrames=Math.max(currentSafety.nearFrames,1);
    }

    // v1.7.3: local evasions first.
    // Don't jump across the whole road unless local space is truly blocked.
    const localOffsets=[-1.20,-.90,-.65,-.42,-.22,0,.22,.42,.65,.90,1.20];
    const lanes=[];
    for(const off of localOffsets){
      lanes.push(Math.max(-maxLane,Math.min(maxLane,currentLane+off)));
    }

    // Add two wider emergency options only when needed.
    lanes.push(-maxLane*.92,maxLane*.92);

    const unique=[...new Set(lanes.map(v=>+v.toFixed(3)))];
    const speeds=[.98,.94,.89,.83];

    let best=null;
    const identitySide=((p.sourceIndex??p.index??0)%2===0)?-1:1;

    for(const lane of unique){
      for(const sm of speeds){
        const s=trajectorySafety172(p,info,lane,sm,nearby,1.60);

        let score=
          s.hardHits*12000 +
          s.risk*130 +
          s.nearFrames*36 +
          Math.max(0,4.5-s.minGap)*88;

        // Strongly prefer smaller, human-like evasions when equally safe.
        const lateralMove=Math.abs(lane-currentLane);
        score+=lateralMove*.085;

        // Larger lane jumps are allowed only if survival benefit is meaningful.
        if(lateralMove>1.15)score+=.30;

        score+=(1-sm)*.025;

        if(Math.sign(lane)===identitySide)score-=.025;

        if(!best||score<best.score){
          best={lane,speedMul:sm,score,...s,lateralMove};
        }
      }
    }

    if(!best)return null;

    // If still unsafe, allow slightly more braking rather than huge weaving.
    if(best.hardHits>0 || best.minGap<2.5){
      best.speedMul=Math.max(.74,best.speedMul-.10);
    }else if(best.minGap<3.2){
      best.speedMul=Math.max(.82,best.speedMul-.06);
    }

    p._unifiedLane172=best.lane;
    p._unifiedUntil172=now+75;

    return {
      lane:best.lane,
      speedMul:best.speedMul,
      dangerous:true,
      unified172:true,
      minGap:best.minGap,
      hardHits:best.hardHits,
      risk:best.risk
    };
  }


  function updatePlayer(p,now,dt){
    if(!p||p.done||p.dead)return;

    p.simPrevX=p.x;p.simPrevY=p.y;

    if(raceStart&&now-raceStart<p.startReactionMs)return;
    if(now<p.stunUntil)return;
    if(p.stunUntil){
      p.stunUntil=0;
      p.invUntil=now+INV_MS;
    }

    p.cleanConfidenceMs=Math.min(12000,(p.cleanConfidenceMs||0)+dt);
    p.cleanConfidence=Math.max(0,Math.min(1,p.cleanConfidenceMs/12000));

    const info=pathInfo120(p);
    p._v120Prog=info.prog;
    p._v120Total=info.total;

    ensureAiState1102(p);
    updateVerifiedEscape1101(p,now);

    let decision=null;
    let state=p._aiState1102;

    // ----------------------------------------------------------
    // EMERGENCY: owns movement until its short action completes.
    // ----------------------------------------------------------
    if(state===AI_STATE_1102.EMERGENCY){
      const e=runEmergencyAction1102(p,now);
      if(e){
        decision=e;
      }else{
        setAiState1102(p,AI_STATE_1102.NORMAL,now);
        state=AI_STATE_1102.NORMAL;
      }
    }

    // ----------------------------------------------------------
    // SURVIVAL EXECUTION: A -> B -> C sequence owns movement.
    // ----------------------------------------------------------
    if(!decision && state===AI_STATE_1102.SURVIVAL){
      // v1.2.4 FINAL FOUNDATION: overlay bridge is temporary; Execution ownership is preserved.
      let overlay1113=runExecutionOverlayBridge1113(p,now);
      let micro1107=null;

      if(!overlay1113)micro1107=runExecutionMicroDodge1107(p,now);

      if(!overlay1113 && !micro1107 && p._executionPlan1101){
        const plan1113=p._executionPlan1101;
        const phase1113=Math.max(0,Math.min((plan1113.points?.length||1)-1,plan1113.phase|0));
        const target1113=Number(plan1113.points?.[phase1113]);
        const lane1113=Number.isFinite(target1113)?target1113:(Number(p._lane120)||0);
        const sm1113=Math.max(.90,Number(plan1113.speed?.[phase1113])||.95);
        const nearby1113=robustNearby192(p,7.5);

        if(nearby1113.length){
          const check1113=trajectorySafety172(p,info,lane1113,sm1113,nearby1113,.18);
          if(nearby1113.length>=4 && check1113.hardHits>0 && check1113.minGap<1.10){
            const built1113=buildExecutionOverlayBridge1113(p,now,info);
            if(built1113 && startExecutionOverlayBridge1115(p,built1113)){
              overlay1113=runExecutionOverlayBridge1113(p,now);
            }
          }else if(check1113.hardHits>0 && check1113.minGap<1.35){
            const built1107=buildExecutionMicroDodge1107(p,now,info);
            if(built1107){
              p._microDodge1107=built1107;
              p._microDodges1107=(p._microDodges1107||0)+1;
              micro1107=runExecutionMicroDodge1107(p,now);
            }
          }
        }
      }

      if(overlay1113){
        decision=overlay1113;
      }else if(micro1107){
        decision=micro1107;
      }else{
        const ex=executeEscapePlan1101(p,now,info);
        if(ex){
          decision={...ex,execution1101:true};
        }else{
          if(p._executionPlan1101 && !p._executionPlan1101.completed)terminateExecution1105(p,"STATE_INTERRUPTED","survival-state-release",now);
          setAiState1102(p,AI_STATE_1102.NORMAL,now);
          state=AI_STATE_1102.NORMAL;
          p._executionPlan1101=null;
        }
      }
    }

    // ----------------------------------------------------------
    // SPECIAL CONTROL: protected unless a real collision forecast appears.
    // ----------------------------------------------------------
    if(!decision && state===AI_STATE_1102.SPECIAL){
      if(p._specialControl197 && specialControlCanContinue1102(p,info)){
        const maxLane=roadHalf120(p,info,info.prog);
        let base=baseLane120(p,now,info,info.prog,maxLane);
        const s=specialControlLane197(p,now,base,maxLane);

        if(s.type){
          decision={
            lane:s.lane,
            speedMul:s.speedMul,
            dangerous:false,
            special1102:true
          };
          p._visualSpin197=s.headingSpin||0;
          p._reverseControl197=!!s.reverse;
        }else{
          setAiState1102(p,AI_STATE_1102.NORMAL,now);
          state=AI_STATE_1102.NORMAL;
        }
      }else{
        if(p._specialControl197 && !p._specialControl197.completed && gauntletMode190){
          gauntletAnalytics191.specialInterrupted197=(gauntletAnalytics191.specialInterrupted197||0)+1;
        }
        p._specialControl197=null;p._specialControlUntil197=0;
        p._visualSpin197=0;p._reverseControl197=false;
        setAiState1102(p,AI_STATE_1102.NORMAL,now);
        state=AI_STATE_1102.NORMAL;
      }
    }

    // ----------------------------------------------------------
    // NORMAL: choose exactly ONE transition.
    // Priority: emergency -> survival execution -> special -> free drive
    // ----------------------------------------------------------
    if(!decision && state===AI_STATE_1102.NORMAL){
      const density=robustNearby192(p,7.5).length;
      const ttc=emergencyTtc195(p,info);
      const dense1111=density>=4;
      const immediateEmergency1111=ttc<=.09;
      let corridorTried1111=false;

      // v1.11.3 dense-threat priority:
      // 4+ nearby threats should keep a planned escape corridor whenever possible.
      // Full emergency is reserved for truly immediate collision risk.
      if(dense1111 && !immediateEmergency1111 && now-(p._executionJustFinished1104||0)>55){
        corridorTried1111=true;
        const corridor=safeCorridor195(p,now,info);
        if(corridor){
          if(p._executionPlan1101)terminateExecution1105(p,"REPLACED","new-dense-corridor-plan",now);
          p._executionPlan1101=buildExecutionPlan1101(p,now,info,corridor);
          if(gauntletMode190)gauntletAnalytics191.executionPlans1101++;
          if(!p._verifiedEscapePending1101)startVerifiedEscape1101(p,now);

          setAiState1102(p,AI_STATE_1102.SURVIVAL,now);
          const ex=executeEscapePlan1101(p,now,info);
          if(ex){
            decision={
              ...ex,
              execution1101:true,
              corridor195:true,
              minGap:corridor.minGap,
              futureMinGap:corridor.futureMinGap,
              hardHits:corridor.hardHits,
              futureHardHits:corridor.futureHardHits,
              reserve:corridor.reserve,
              edgeEmergency:!!corridor.edgeEmergency,
              risk:corridor.risk
            };
            p._denseExecutionStarts1111=(p._denseExecutionStarts1111||0)+1;
          }
        }
      }

      const emergencyThreshold=
        density>=5?.17:
        density>=3?.15:
        .13;

      if(!decision && (immediateEmergency1111 || (!dense1111 && ttc<=emergencyThreshold))){
        traceEmergencyDetected1105(p,now);
        traceEmergencyRequested1105(p,now);
        const act=buildEmergencyAction1102(p,now,info);
        if(act){
          p._emergencyAction1102=act;
          p._emergencyActionUntil1102=act.until;
          setAiState1102(p,AI_STATE_1102.EMERGENCY,now);
          traceEmergencyEntered1105(p,now);
          if(gauntletMode190)gauntletAnalytics191.emergencyFallbacks++;
          decision=runEmergencyAction1102(p,now);
        }
      }

      if(!decision && !corridorTried1111 && now-(p._executionJustFinished1104||0)>55){
        const corridor=safeCorridor195(p,now,info);
        if(corridor){
          if(p._executionPlan1101)terminateExecution1105(p,"REPLACED","new-corridor-plan",now);
          p._executionPlan1101=buildExecutionPlan1101(p,now,info,corridor);
          if(gauntletMode190)gauntletAnalytics191.executionPlans1101++;
          if(!p._verifiedEscapePending1101)startVerifiedEscape1101(p,now);

          setAiState1102(p,AI_STATE_1102.SURVIVAL,now);
          const ex=executeEscapePlan1101(p,now,info);

          if(ex){
            decision={
              ...ex,
              execution1101:true,
              corridor195:true,
              minGap:corridor.minGap,
              futureMinGap:corridor.futureMinGap,
              hardHits:corridor.hardHits,
              futureHardHits:corridor.futureHardHits,
              reserve:corridor.reserve,
              edgeEmergency:!!corridor.edgeEmergency,
              risk:corridor.risk
            };
          }
        }
      }

      // Special controls only when the road is actually calm.
      if(!decision && density<3){
        const maxLane=roadHalf120(p,info,info.prog);
        const special=maybeSpecialControl197(p,now,info,maxLane);

        if(special){
          setAiState1102(p,AI_STATE_1102.SPECIAL,now);
          let base=baseLane120(p,now,info,info.prog,maxLane);
          const s=specialControlLane197(p,now,base,maxLane);

          if(s.type){
            decision={
              lane:s.lane,
              speedMul:s.speedMul,
              dangerous:false,
              special1102:true
            };
            p._visualSpin197=s.headingSpin||0;
            p._reverseControl197=!!s.reverse;
          }
        }
      }

      if(!decision){
        decision=freeDrivingDecision130(p,now,info);
      }
    }

    // ----------------------------------------------------------
    // Last-resort emergency override ONLY if state is not already emergency
    // and a hard collision is imminent.
    // ----------------------------------------------------------
    if(p._aiState1102!==AI_STATE_1102.EMERGENCY){
      const nearby=robustNearby192(p,7.5);
      if(nearby.length){
        const requestedLane1107=Number(decision?.lane);
        const lane=Number.isFinite(requestedLane1107)?requestedLane1107:(Number(p._lane120)||0);
        const sm=Math.max(.82,Number(decision?.speedMul)||1);
        const hardCheck=trajectorySafety172(p,info,lane,sm,nearby,.28);

        if(hardCheck.hardHits>0 && hardCheck.minGap<1.35){
          if(p._aiState1102===AI_STATE_1102.SURVIVAL && p._executionPlan1101){
            if(nearby.length<4){
              if(!p._microDodge1107){
                const built1107=buildExecutionMicroDodge1107(p,now,info);
                if(built1107){
                  p._microDodge1107=built1107;
                  p._microDodges1107=(p._microDodges1107||0)+1;
                }
              }
              decision=runExecutionMicroDodge1107(p,now)||decision;
            }else if(hardCheck.minGap<.95){
              if(!p._executionOverlayBridge1113){
                const built1113=buildExecutionOverlayBridge1113(p,now,info);
                if(built1113 && startExecutionOverlayBridge1115(p,built1113)){
                  p._denseEmergencyOverrides1111=(p._denseEmergencyOverrides1111||0)+1;
                }
              }
              decision=runExecutionOverlayBridge1113(p,now)||decision;
            }
          }else{
            traceEmergencyDetected1105(p,now);
            traceEmergencyRequested1105(p,now);
            const act=buildEmergencyAction1102(p,now,info);
            if(act){
              p._emergencyAction1102=act;
              p._emergencyActionUntil1102=act.until;
              setAiState1102(p,AI_STATE_1102.EMERGENCY,now);
              traceEmergencyEntered1105(p,now);

              if(gauntletMode190)gauntletAnalytics191.emergencyFallbacks++;
              decision=runEmergencyAction1102(p,now)||decision;
            }
          }
        }
      }
    }

    if(!decision){
      decision=freeDrivingDecision130(p,now,info);
    }

    p.liveEvadeDanger=decision.dangerous?1:0;
    p.liveEvadeAction=
      decision?.executionOverlayBridge1113?"execution-overlay-bridge":
      decision?.microDodge1107?"micro-dodge":
      p._aiState1102===AI_STATE_1102.EMERGENCY?"emergency-state":
      p._aiState1102===AI_STATE_1102.SURVIVAL?"execution-state":
      p._aiState1102===AI_STATE_1102.SPECIAL?"special-control":
      "free-drive";

    if(decision.dangerous)p.match.avoids=(p.match.avoids||0)+1;

    if(gauntletMode190){
      recordAvoidDecision191(p,decision,now);
      gauntletAnalytics191.executionReplans1101=players.reduce((s,q)=>s+(q._executionReplans1101||0),0);
      gauntletAnalytics191.executionCompletions1101=players.reduce((s,q)=>s+(q._executionCompleted1101||0),0);
      gauntletAnalytics191.executionPartialReplans1103=players.reduce((s,q)=>s+(q._executionPartialReplans1103||0),0);
      gauntletAnalytics191.executionFailures1104=players.reduce((s,q)=>s+(q._executionFailed1104||0),0);
      gauntletAnalytics191.executionStageTimeouts1105=players.reduce((s,q)=>s+(q._executionStageTimeouts1105||0),0);
      gauntletAnalytics191.microDodges1107=players.reduce((s,q)=>s+(q._microDodges1107||0),0);
      gauntletAnalytics191.microDodgeResumes1107=players.reduce((s,q)=>s+(q._microDodgeResumes1107||0),0);
      gauntletAnalytics191.executionInvalidSudden1108=players.reduce((s,q)=>s+(q._executionInvalidSudden1108||0),0);
      gauntletAnalytics191.executionInvalidSideFlip1108=players.reduce((s,q)=>s+(q._executionInvalidSideFlip1108||0),0);
      gauntletAnalytics191.executionInvalidCrowd1108=players.reduce((s,q)=>s+(q._executionInvalidCrowd1108||0),0);
      gauntletAnalytics191.executionTimedOut1108=players.reduce((s,q)=>s+(q._executionTimedOut1108||0),0);
      gauntletAnalytics191.stallRescues1110=players.reduce((s,q)=>s+(q._stallRescues1110||0),0);
      gauntletAnalytics191.denseExecutionStarts1111=players.reduce((s,q)=>s+(q._denseExecutionStarts1111||0),0);
      gauntletAnalytics191.denseEmergencyOverrides1111=players.reduce((s,q)=>s+(q._denseEmergencyOverrides1111||0),0);
      gauntletAnalytics191.executionOverlayActive1115=players.reduce((s,q)=>s+(q._executionOverlayBridge1113?1:0),0);
      gauntletAnalytics191.executionOverlayAccountingError1115=Math.max(
        0,
        (gauntletAnalytics191.executionOverlayResumes1113||0)-
        (gauntletAnalytics191.executionOverlayBridges1113||0)
      );
      gauntletAnalytics191.stateChanges1102=players.reduce((s,q)=>s+(q._aiStateChanges1102||0),0);
    }

    const sensor192=immediateSensorCheck192(p,9.5);
    p._debugDecision190={
      action:p.liveEvadeAction,
      lane:+(Number(decision.lane)||0).toFixed(2),
      predMin:Number.isFinite(decision.minGap)?+decision.minGap.toFixed(2):null,
      speedMul:+(Number(decision.speedMul)||1).toFixed(2),
      sensorNearest:Number.isFinite(sensor192.nearest)?+sensor192.nearest.toFixed(2):null,
      sensorCount:sensor192.count,
      futureMinGap:Number.isFinite(decision.futureMinGap)?+decision.futureMinGap.toFixed(2):null,
      reserve:Number.isFinite(decision.reserve)?+decision.reserve.toFixed(2):null
    };

    const moved=movementStep120(p,now,dt,info,decision.lane,decision.speedMul);
    const frac=moved.frac;

    recordMovementTelemetry120(p,now,dt,frac);

    if(collideObservers120(p,now,frac))return;
    if(finishPlayer120(p,now,dt,frac))return;
  }





  // v4.59.9 rolling AI death blackbox. Keeps only the last ~5.5 seconds.


  function summarizeAiBlackbox(p,now){
    const samples=(Array.isArray(p.aiBlackbox)?p.aiBlackbox:[]).filter(x=>x.t>=now-5000);
    const clicks=(Array.isArray(p.mouseClickLog)?p.mouseClickLog:[]).filter(x=>x.t>=now-5000);
    const modeCounts={}; for(const c of clicks) modeCounts[c.mode]=(modeCounts[c.mode]||0)+1;
    let maxSeen=0,maxDanger=0,routeBreakFrames=0,commitFrames=0,reactionPendingFrames=0;
    for(const x of samples){maxSeen=Math.max(maxSeen,x.perceived28||0);maxDanger=Math.max(maxDanger,x.danger||0);if(x.routeBreak)routeBreakFrames++;if(x.committed)commitFrames++;if(x.reactionPending)reactionPendingFrames++;}
    return {
      windowMs:5000,sampleCount:samples.length,clickCount:clicks.length,modeCounts,
      maxSeen,maxDanger:+maxDanger.toFixed(3),routeBreakFrames,commitFrames,reactionPendingFrames,
      lastClicks:clicks.slice(-14).map(c=>({...c,ageMs:Math.round(now-c.t)})),
      trace:samples.slice(-46)
    };
  }

  // v4.42 DEATH-CAUSE ANALYSIS:
  // Capture what the racer actually knew/did immediately before death. This is
  // diagnostic telemetry only; it never changes movement, collision, or survival.
  function deathCauseSnapshot(p,now,hitObserver=null,forcedCause=null){
    const si=Math.min(p.seg,segs.length-1), s=segs[si];
    const recent=(Array.isArray(p.mouseClickLog)&&p.mouseClickLog.length)?p.mouseClickLog[p.mouseClickLog.length-1]:null;
    const clickAge=recent?Math.max(0,now-recent.t):null;
    const perceived=playerPerceivedObservers(p,12.5);
    let close=0, veryClose=0;
    for(const o of perceived){
      const d=Math.hypot(o.x-p.x,o.y-p.y);
      if(d<7.0) close++;
      if(d<3.2) veryClose++;
    }
    const lat=(p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny;
    const roadHalf=Math.max(1.8,widths[si]*ROAD_MARGIN);
    const rejoin=/recover/.test(p.liveEvadeAction||'');
    const reacting=!!p.reactionDangerActive;
    const reactionPending=reacting && (p.mouseReactionReadyAt||0)>now;
    let cause=forcedCause;
    if(!cause){
      if(veryClose>=3 || close>=4) cause='SURROUNDED';
      else if(rejoin) cause='EARLY_REJOIN';
      else if(reactionPending) cause='LATE_REACTION';
      else if((p.mouseMode||'race')==='race' && close>0) cause='NO_EVADE';
      else if(recent && recent.mode!=='race' && clickAge!=null && clickAge<950) cause='WRONG_EVADE';
      else if(perceived.length===0) cause='MISSED_PERCEPTION';
      else cause='CONTACT';
    }
    return {
      cause,
      lastClick:recent?{ageMs:Math.round(clickAge),x:recent.x,y:recent.y,mode:recent.mode,threatId:recent.threatId}:null,
      mouseMode:p.mouseMode||'race', evadeAction:p.liveEvadeAction||'none',
      dangerTier:p.dangerTier||0, reactionPending,
      perceived12:perceived.length, close7:close, veryClose3:veryClose,
      lateral:+lat.toFixed(2), roadHalf:+roadHalf.toFixed(2),
      hitObserver:hitObserver?{id:hitObserver.index??hitObserver.id??-1,x:+hitObserver.x.toFixed(2),y:+hitObserver.y.toFixed(2)}:null,
      blackbox:summarizeAiBlackbox(p,now)
    };
  }

  const DEATH_CAUSE_KO={
    OUTSIDE:'코스 이탈',SURROUNDED:'다중 포위',EARLY_REJOIN:'너무 빠른 복귀',
    LATE_REACTION:'반응 지연',NO_EVADE:'회피 시작 지연',WRONG_EVADE:'잘못된 회피 방향',
    MISSED_PERCEPTION:'인지 실패',CONTACT:'접촉'
  };



  function updateObservers(now,dt=16){
    const sec=Math.min(0.05,Math.max(0,dt/1000));
    const margin=2.8;

    for(let oi=0;oi<observers.length;oi++){
      const o=observers[oi];
      // v3.7: retain the exact previous simulation position for relative swept collision.
      o.simPrevX=o.x; o.simPrevY=o.y;
      if(!o.phaseUntil){
        const offset=o.cycleOffset||0;
        if(offset<OBS_MOVE_MS){
          o.phase="move";
          o.phaseUntil=now+(OBS_MOVE_MS-offset);
        }else{
          o.phase="stop";
          o.phaseUntil=now+(OBS_MOVE_MS+OBS_STOP_MS-offset);
          o.vx=0; o.vy=0;
        }
        o.cycleOffset=0;
      }

      if(now>=o.phaseUntil){
        if(o.phase==="move"){
          o.phase="stop";
          o.phaseUntil=now+OBS_STOP_MS;
          o.vx=0; o.vy=0;
        }else{
          o.phase="move";
          o.phaseUntil=now+OBS_MOVE_MS;
          o.speed=(9.72*OBS_SPEED_RATIO)*(0.98+Math.random()*0.04);
          pickObserverLeg712(o);
        }
      }

      if(o.phase==="move"){
        o.x+=o.vx*sec;
        o.y+=o.vy*sec;

        // Safety only: keep the observer inside the map. The selected leg normally
        // avoids these borders, so direction changes occur after the 1-second stop.
        if(o.x<margin){ o.x=margin; o.vx=Math.abs(o.vx); }
        else if(o.x>MAP_W-margin){ o.x=MAP_W-margin; o.vx=-Math.abs(o.vx); }
        if(o.y<margin){ o.y=margin; o.vy=Math.abs(o.vy); }
        else if(o.y>MAP_H-margin){ o.y=MAP_H-margin; o.vy=-Math.abs(o.vy); }
      }
    }
  }

  let cameraLeaderId=-1;
  let cameraLeaderHoldUntil=0;
  let lastRankingRender=0;
  let lastVisibleObs=0;
  let lastLeaderName="";
  let raceEventText="";
  let raceEventUntil=0;
  let broadcastFocusId=-1;
  let broadcastFocusUntil=0;
  let previousUiRanks=new Map();
  let diagFrames=0, diagFps=0, diagLastFpsTs=0, diagFrameMs=0, diagMaxFrameMs=0;
  let fpsProtectLevel=0, fpsLowSince=0, fpsGoodSince=0;
  function updateFpsProtection(now){
    if(!running) return;
    // v7.96: eight-racer final QA protection. Degrade visual-only work earlier during
    // sustained frame pressure; simulation cadence and race physics remain unchanged.
    const lowFps796=players.length>=8?46:42;
    const goodFps796=players.length>=8?56:54;
    if(diagFps>0 && diagFps<lowFps796){
      fpsGoodSince=0;
      fpsLowSince=fpsLowSince||now;
      if(now-fpsLowSince>1200 && fpsProtectLevel<2){
        fpsProtectLevel++;
        fpsLowSince=now;
      }
    }else if(diagFps>=goodFps796){
      fpsLowSince=0;
      fpsGoodSince=fpsGoodSince||now;
      if(now-fpsGoodSince>4500 && fpsProtectLevel>0){
        fpsProtectLevel--;
        fpsGoodSince=now;
      }
    }else{
      fpsLowSince=0;fpsGoodSince=0;
    }
  }
  let raceLeaderChanges=0, raceTotalOvertakes=0;
  // v2.17 replay: lightweight snapshots of the actual live race.
  let replayFrames=[], replayLastCapture=0, replayPlaying=false, replayRaf=0;
  let replayCursor=0, replaySpeed=1, replayLastTs=0, replayFocusId=-1;
  let replayArchive={};
  let highlightMarkers=[];
  let highlightArchive={};
  let photoFinishArchive={};
  let replaySelectedRound=1;
  let lastCloseBattleKey="", lastCloseBattleEventAt=0;
  let broadcastStoryKey="", broadcastStoryUntil=0;
  let broadcastTickerUntil=0, broadcastTickerText="";
  let broadcastLastRankSnapshot=new Map();
  const SECTOR_MARKS=[0.25,0.50,0.75];
  let bestSector=[null,null,null];


  let liveEventFeed814=[];
  let liveFocus814={playerId:-1,type:"",text:"",until:0};
  let commentaryItems=[];
  let commentaryLastKey="";
  let commentaryLastAt=0;
  let commentaryLastGeneralAt=0;
  function commentaryLine(key,text,now=gameNow(),force=false){
    if(!force&&key===commentaryLastKey&&now-commentaryLastAt<2600)return;
    if(!force&&now-commentaryLastAt<900)return;
    commentaryLastKey=key;commentaryLastAt=now;
    commentaryItems.unshift({text,time:raceStart?Math.max(0,now-raceStart):0});
    if(commentaryItems.length>7)commentaryItems.length=7;
    const lead=document.getElementById("commentaryLead"),feed=document.getElementById("commentaryFeed");
    if(lead)lead.textContent=text;
    if(feed)feed.innerHTML=commentaryItems.map((x,i)=>`<div class="commentary-line ${i===0?"latest":""}"><span>${(x.time/1000).toFixed(1)}초</span><b>${x.text}</b></div>`).join("");
  }

  function setBroadcastStory(key,kicker,title,sub,now=gameNow(),hold=1800){
    const k={"NEW LEADER":"선두 교체","FINAL BATTLE":"결승선 승부","3-WAY BATTLE":"3인 접전","BIG COMEBACK":"대역전","LEADER WATCH":"선두 수성","PHOTO FINISH":"포토피니시"}[kicker]||kicker;
    commentaryLine(`story-${key}`,`${k}! ${title}${sub?` · ${sub}`:""}`,now);
  }

  
  let unifiedCameraLeader121=-1;
  let unifiedCameraHoldUntil121=0;
  let camVelX121=0,camVelY121=0;
  function smoothUnifiedCamera121(dt,tx,ty){
    const dtSec=Math.max(.001,Math.min(.026,(Number(dt)||20)/1000));
    const dx=tx-camX,dy=ty-camY;

    const accel=10.5;
    camVelX121+=dx*accel*dtSec;
    camVelY121+=dy*accel*dtSec;

    const damp=Math.exp(-8.4*dtSec);
    camVelX121*=damp;camVelY121*=damp;

    const maxV=15;
    const v=Math.hypot(camVelX121,camVelY121);
    if(v>maxV){
      camVelX121*=maxV/v;camVelY121*=maxV/v;
    }

    camX+=camVelX121*dtSec;
    camY+=camVelY121*dtSec;
  }


  function unifiedCameraSubject121(now){
    const active=players.filter(p=>!p.done&&!p.dead);
    if(!active.length)return null;
    active.sort((a,b)=>currentProgress(b)-currentProgress(a));
    const leader=active[0];

    const held=players.find(p=>p.index===unifiedCameraLeader121&&!p.done&&!p.dead);
    if(held){
      const gap=currentProgress(leader)-currentProgress(held);
      // keep current subject during tiny position swaps / side-by-side corners
      if(now<unifiedCameraHoldUntil121 || gap<1.8)return held;
    }

    unifiedCameraLeader121=leader.index;
    unifiedCameraHoldUntil121=now+900;
    return leader;
  }
  function updateCamera(dt){
    const now=gameNow();

    const pov=players[povPlayerIndex];
    if(povPlayerIndex>=0&&pov&&!pov.done&&!pov.dead){
      cameraLeaderId=pov.index;
      const info=pathInfo120(pov);
      const frame=smoothFrame120(info,Number(pov._v120Prog)||info.prog);
      if(info.destiny){
        const centerX=Number(currentMap770().destinyCameraCenterX8172)||89.0;
        smoothUnifiedCamera121(dt,centerX,frame.y);
        camX=centerX;camVelX121=0;
      }else{
        const lead=1.0;
        smoothUnifiedCamera121(dt,frame.x+frame.ux*lead,frame.y+frame.uy*lead);
      }
      return;
    }

    const leader=unifiedCameraSubject121(now);
    if(!leader)return;
    cameraLeaderId=leader.index;

    const info=pathInfo120(leader);
    const frame=smoothFrame120(info,Number(leader._v120Prog)||info.prog);

    if(info.destiny){
      const centerX=Number(currentMap770().destinyCameraCenterX8172)||89.0;
      smoothUnifiedCamera121(dt,centerX,frame.y);
      camX=centerX;camVelX121=0;
      return;
    }

    const lead=.95;
    smoothUnifiedCamera121(dt,frame.x+frame.ux*lead,frame.y+frame.uy*lead);
  }


  function finalizeIndividualClear(finishers,now){
    if(roundTransitioning) return; roundTransitioning=true;

    if(league100?.phase==="racing"){
      const bestMs=Math.round(finishers[0].finishTime);
      const tied=finishers.filter(p=>Math.round(p.finishTime)===bestMs);

      // Exact tie: replay the same heat, no point awarded.
      if(tied.length!==1){
        running=false;
        roundTransitioning=false;
        setTimeout(()=>continueLeagueHeat100(),180);
        return;
      }

      const winnerPlayer=tied[0];
      const pair=leaguePair100();

      // v1.0.1 robust league winner mapping:
      // sourceIndex is preferred, but name/index fallbacks prevent a clear from scoring 0.
      let winner=null;
      if(winnerPlayer.sourceIndex===pair.A||winnerPlayer.name===names[pair.A])winner="A";
      else if(winnerPlayer.sourceIndex===pair.B||winnerPlayer.name===names[pair.B])winner="B";
      else if(winnerPlayer.index===0)winner="A";
      else if(winnerPlayer.index===1)winner="B";

      running=false;
      roundTransitioning=false;

      if(winner){
        awardLeagueHeat100(winner);
      }else{
        // Defensive fallback: never silently lose a legitimate clear.
        const fallback=(winnerPlayer.index||0)===0?"A":"B";
        awardLeagueHeat100(fallback);
      }
      renderLeagueSide100();
      return;
    }

    const bestMs=Math.round(finishers[0].finishTime);
    const tied=finishers.filter(p=>Math.round(p.finishTime)===bestMs);
    tied.forEach(p=>{
      const row=playerTournament[p.index]; if(row){row.total+=1;row.rounds.push({round:currentRound,rank:1,points:1,time:p.finishTime,rating:0});}
    });
    renderPersonalScore();
    const winners=tied.map(p=>p.name).join(" · ");
    commentaryLine(`clear-${currentRound}-${bestMs}`,`${ROUND_UNIT_NAMES[currentRound]} 클리어! ${winners} +1점`,now,true);
    const champion=tied.find(p=>(playerTournament[p.index]?.total||0)>=5) || players.find(p=>(playerTournament[p.index]?.total||0)>=5);
    if(champion){
      running=false; startBtn.textContent=`우승 · ${champion.name}`;
      setBroadcastStory("champion","WINNER",`${champion.name} 개인전 우승`,`5클리어 달성`,now,999999);
      return;
    }
    setTimeout(()=>{currentRound=currentRound%5+1;resetRound();start();},900);
  }

  function restartSameIndividualRound(){
    if(roundTransitioning) return; roundTransitioning=true;
    const r=currentRound;
    setBroadcastStory(`all-dead-${r}`,"ALL OUT",`${ROUND_UNIT_NAMES[r]} 전원 사망`,`같은 경기 재시작`,gameNow(),900);
    if(league100?.phase==="racing"){
      setTimeout(()=>{roundTransitioning=false;continueLeagueHeat100();},220);
      return;
    }
    setTimeout(()=>{currentRound=r;resetRound();start();},900);
  }

  function finalizeRound(){
    if(roundTransitioning) return;
    roundTransitioning=true;

    const ordered=[...players].sort((a,b)=>a.finishTime-b.finishTime);
    const result={round:currentRound,unit769:{...unitChassis764(currentRound)},
      team:{RED:0,BLUE:0},
      leaderChanges:raceLeaderChanges,totalOvertakes:raceTotalOvertakes,players:[]};

    ordered.forEach((p,idx)=>{
      const pts=ROUND_POINTS[idx];
      const team=p.team;
      if(isTeamMode()&&team){
        result.team[team]=(result.team[team]||0)+pts;
        teamTotals[team]=(teamTotals[team]||0)+pts;
      }
      playerTournament[p.index].total+=pts;
      playerTournament[p.index].rounds.push({
        round:currentRound,rank:idx+1,points:pts,time:p.finishTime,rating:0
      });
      result.players.push({
        index:p.index,name:p.name,team,rank:idx+1,points:pts,time:p.finishTime,
        collisions:p.match.collisions||0,
        deathPoints:(p.match.deathPoints||[]).map(d=>({...d})),
        overtakes:p.match.overtakes||0,
        avoids:p.match.avoids||0,nearMisses:p.match.nearMisses||0,extremeNearMisses:p.match.extremeNearMisses||0,dangerExposureMs:p.match.dangerExposureMs||0,
        leadMs:p.match.leadMs||0,
        controlAttempts:p.match.controlAttempts||0,
        controlSuccesses:p.match.controlSuccesses||0,
        controlByType:JSON.parse(JSON.stringify(p.match.controlByType||{})),
        passPlans:{...(p.match.passPlans||{})},
        insideRate:p.match.lineSamples?100*p.match.insideHits/p.match.lineSamples:0,
        extremeInsideRate:p.match.lineSamples?100*p.match.extremeInsideHits/p.match.lineSamples:0,
        distance:p.match.distance||0,
        efficiency:p.match.distance?100*routeLength/p.match.distance:0,
        rankGain:Math.max(0,(p.match.startRank||12)-(p.match.bestRank||12)),
        trace:(p.match.trace||[]).slice(),
        bestSector:p.sectorTimes&&p.sectorTimes.length?Math.min(...p.sectorTimes):null,
        raceForm:p.raceForm,
        startReactionMs:p.startReactionMs,
        startExecution:p.startExecution,
        analytics749:playerAnalytics749(p),
        unitCompatibility769:{...unitCompatibility769(p,currentRound)},
        rating:0
      });
    });

    for(const x of result.players){
      const pp=players[x.index];
      x.rating=pp?performanceRating749(pp,x.rank):roundPerformanceRating(x);
      const rr=playerTournament[x.index]?.rounds?.find(q=>q.round===currentRound);
      if(rr) rr.rating=x.rating;
    }

    replayArchive[currentRound]=replayFrames.slice();
    highlightArchive[currentRound]=highlightMarkers.slice();

    const top1=result.players[0], top2=result.players[1];
    if(top1 && top2){
      const gap=Math.abs(top2.time-top1.time);
      if(gap<=500){
        const photoTier=gap<=10?"DEAD HEAT":gap<=50?"ULTRA PHOTO":gap<=150?"PHOTO FINISH":"CLOSE FINISH";
        photoFinishArchive[currentRound]={
          gap,winner:top1.name,second:top2.name,time:top1.time,tier:photoTier,
          text:`${photoTier} · ${top1.name} vs ${top2.name} · +${(gap/1000).toFixed(3)}s`
        };
        const marker={type:"PHOTO_FINISH",text:photoFinishArchive[currentRound].text,
          t:Math.max(0,top1.time-450),playerId:top1.index,importance:3};
        highlightArchive[currentRound].push(marker);
        tournamentHighlights.push({round:currentRound,type:"PHOTO_FINISH",text:photoFinishArchive[currentRound].text});
      }
    }

    for(const x of result.players){
      const startRank=(players[x.index].match?.startRank)||12;
      const gain=startRank-x.rank;
      if(gain>=4){
        const marker={type:"COMEBACK",text:`COMEBACK · ${x.name} · ${startRank}위 → ${x.rank}위`,
          t:Math.max(0,x.time-4500),playerId:x.index,importance:3};
        highlightArchive[currentRound].push(marker);
        tournamentHighlights.push({round:currentRound,type:"COMEBACK",text:marker.text});
      }
    }

    const roundWinner=result.players[0];
    if(roundWinner){
      tournamentHighlights.push({round:currentRound,type:"WIN",text:`WIN · ${roundWinner.name} · ${formatTime(roundWinner.time)}`});
    }
    const topPass=[...result.players].sort((a,b)=>b.overtakes-a.overtakes || a.rank-b.rank)[0];
    if(topPass&&topPass.overtakes>0){
      tournamentHighlights.push({round:currentRound,type:"OVERTAKE",text:`BEST OVERTAKE · ${topPass.name} · ${topPass.overtakes}회`});
    }
    const clean=[...result.players].filter(x=>x.collisions===0).sort((a,b)=>a.rank-b.rank)[0];
    if(clean){
      tournamentHighlights.push({round:currentRound,type:"CLEAN",text:`무충돌 베스트 · ${clean.name} · 무충돌 ${clean.rank}위`});
    }

    recordAnalyticsRound749(result);
    recordUnitRound769(result);
    roundHistory.push(result);
    rebuildTournamentStandings();
    recordLiveBalanceRound(result);
    renderTeamScore();

    if(currentRound<5){
      startBtn.textContent=`${currentRound}R 종료`;
      setTimeout(()=>{
        currentRound++;
        resetRound();
        start();
      },1200);
    }else{
      running=false;
      recordSeasonResults();
      publishMasterResult();
      startBtn.textContent="5R 경기 종료";
      setTimeout(showMatchResults,350);
    }
  }
  function renderTeamScore(){
    const teamEl=document.getElementById("teamScoreBoard"),personalEl=document.getElementById("personalScoreBoard");
    if(isTeamMode()){
      if(personalEl)personalEl.style.display="none";
      if(teamEl){teamEl.style.display="block";teamEl.innerHTML=`<div class="v813-team-live">
        <div class="v813-team-side v813-red"><span>빨강팀</span><strong>${teamTotals.RED||0}</strong></div>
        <div class="v813-vs">VS</div>
        <div class="v813-team-side v813-blue"><strong>${teamTotals.BLUE||0}</strong><span>파랑팀</span></div></div>`;}
    }else{
      if(teamEl){teamEl.style.display="none";teamEl.innerHTML="";}
      if(personalEl)personalEl.style.display="block";renderPersonalScore();
    }
  }
  function renderPersonalScore(){
    const el=document.getElementById("personalScoreBoard");if(!el)return;
    if(isTeamMode()){el.style.display="none";el.innerHTML="";return;}
    el.style.display="block";
    const rows=Object.values(playerTournament).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));
    el.innerHTML=`<div class="personal-score-title">8인 개인전 · 5클리어 선승</div>`+
      rows.map((pt,i)=>`<div class="personal-score-row"><span class="personal-rank">${i+1}</span>
      <span class="score-dot" style="background:${INDIVIDUAL_COLORS[i%INDIVIDUAL_COLORS.length]}"></span>
      <span class="personal-name">${pt.name}</span><b>${pt.total}</b></div>`).join("");
  }


  function renderDiagnostics(){
    const el=document.getElementById("diagnostics");
    if(!el || el.classList.contains("hidden")) return;
    let collisions=0,finishes=0,totalTime=0;
    for(const p of players){collisions+=p.match.collisions||0;if(p.done&&p.finishTime!=null){finishes++;totalTime+=p.finishTime;}}
    const avg=finishes?formatTime(totalTime/finishes):"--";
    const alive=players.filter(p=>!p.dead&&!p.done);
    const clicks=players.reduce((n,p)=>n+(p.mouseClickSeq||0),0);
    const stops=players.reduce((n,p)=>n+((p.mouseClickLog||[]).filter(c=>c.mode==='stop').length),0);
    const evadeClicks=players.reduce((n,p)=>n+((p.mouseClickLog||[]).filter(c=>c.mode&&c.mode!=='race').length),0);
    const redundant=players.reduce((n,p)=>n+(p.aiDiagRedundantClicks||0),0);
    const modeChanges=players.reduce((n,p)=>n+(p.aiDiagModeChanges||0),0);
    const avgReaction=players.length?players.reduce((n,p)=>n+(p.lastReactionDelayMs||0),0)/players.length:0;
    const elapsedSec=Math.max(1,((gameNow()-(raceStart||gameNow()))/1000));
    const clickRate=clicks/elapsedSec/Math.max(1,players.length);
    const stopRate=clicks?stops/clicks*100:0;
    const warnings=[];
    if(clickRate>5.0) warnings.push('과다 클릭');
    if(stopRate>5.0) warnings.push('스탑 과다');
    if(redundant>Math.max(8,clicks*.12)) warnings.push('중복 클릭');
    if(modeChanges>Math.max(12,clicks*.22)) warnings.push('판단 전환 과다');
    el.innerHTML=`<b>v4.30 AI 진단</b><br>FPS ${diagFps.toFixed(0)} · frame ${diagFrameMs.toFixed(1)}ms · max ${diagMaxFrameMs.toFixed(1)}ms · 자동보호 ${fpsProtectLevel}<br>생존 ${alive.length}/8 · 옵저버 ${observers.length} · 충돌 ${collisions} · 완주 ${finishes}/8 · 평균 ${avg}<br>클릭 ${clicks} · 1인 초당 ${clickRate.toFixed(2)} · 회피클릭 ${evadeClicks} · 스탑 ${stops} (${stopRate.toFixed(1)}%)<br>평균 최근 반응 ${avgReaction.toFixed(0)}ms · 중복클릭 ${redundant} · 행동전환 ${modeChanges}<br>${warnings.length?`⚠ ${warnings.join(' · ')}`:'AI 입력 진단 정상'}`;
  }

  const SIM_STEP_MS = 1000/50;
  const MAX_SIM_STEPS = 1;
  let simClock=0;
  let simTickCounter=0;
  let simAccumulator=0;
  function gameNow(){
    return (running && raceStart && simClock) ? simClock : performance.now();
  }


  function captureReplayFrame(now){
    if(!raceStart || now-replayLastCapture<190) return; // ~5.9 fps replay data
    replayLastCapture=now;
    if(replayFrames.length>=560) return;
    replayFrames.push({
      t:Math.max(0,now-raceStart),
      p:players.map(p=>[+p.x.toFixed(2),+p.y.toFixed(2),p.done?1:0,currentProgress(p)]),
      leader:(()=>{
        let id=0,best=-1;
        for(let i=0;i<players.length;i++){
          const pr=currentProgress(players[i]);
          if(pr>best){best=pr;id=i;}
        }
        return id;
      })()
    });
  }

  function activeReplayFrames(){
    return replayArchive[replaySelectedRound] || replayFrames;
  }

  function replayDuration(){
    const frames=activeReplayFrames();
    return frames.length?frames[frames.length-1].t:0;
  }

  function replayFrameAt(ms){
    const frames=activeReplayFrames();
    if(!frames.length) return null;
    let lo=0,hi=frames.length-1;
    while(lo<hi){
      const mid=(lo+hi+1)>>1;
      if(frames[mid].t<=ms) lo=mid; else hi=mid-1;
    }
    return frames[lo];
  }

  function drawReplayFrame(frame){
    const rc=document.getElementById("replayCanvas");
    if(!rc||!frame) return;
    const rctx=rc.getContext("2d");
    rctx.clearRect(0,0,rc.width,rc.height);
    if(map.complete&&map.naturalWidth>0) rctx.drawImage(map,0,0,rc.width,rc.height);
    const sx=rc.width/MAP_W, sy=rc.height/MAP_H;
    const focus=replayFocusId>=0?replayFocusId:frame.leader;
    for(let i=0;i<frame.p.length;i++){
      const q=frame.p[i], p=players[i];
      const x=q[0]*sx, y=q[1]*sy, focused=i===focus;
      rctx.beginPath();
      rctx.arc(x,y,focused?5.8:3.9,0,Math.PI*2);
      rctx.fillStyle=leagueTeamColor105(p);
      rctx.fill();
      rctx.strokeStyle=focused?"#ffffff":"#07111a";
      rctx.lineWidth=focused?2.2:1.2;
      rctx.stroke();

      rctx.font=`${focused?"800":"700"} 10px system-ui`;
      rctx.textAlign="left";
      rctx.textBaseline="middle";
      rctx.lineWidth=3;
      rctx.strokeStyle="rgba(0,0,0,.92)";
      rctx.strokeText(p.name,x+6,y-6);
      rctx.fillStyle="#ffffff";
      rctx.fillText(p.name,x+6,y-6);
    }
    const time=document.getElementById("replayTime");
    if(time) time.textContent=`${formatTime(replayCursor)} / ${formatTime(replayDuration())}`;
  }

  function setReplayCursor(ms){
    replayCursor=Math.max(0,Math.min(replayDuration(),ms));
    const slider=document.getElementById("replaySlider");
    if(slider) slider.value=String(replayCursor);
    drawReplayFrame(replayFrameAt(replayCursor));
  }

  function replayLoop(ts){
    if(!replayPlaying) return;
    if(!replayLastTs) replayLastTs=ts;
    const dt=ts-replayLastTs; replayLastTs=ts;
    replaySpeed=1; setReplayCursor(replayCursor+dt);
    if(replayCursor>=replayDuration()){
      replayPlaying=false;
      const b=document.getElementById("replayPlay");
      if(b) b.textContent="▶ 재생";
      return;
    }
    replayRaf=requestAnimationFrame(replayLoop);
  }

  function openReplay(roundOverride=null,seekMs=null,slow=false){
    const available=Object.keys(replayArchive).map(Number).sort((a,b)=>a-b);
    if(!available.length && !replayFrames.length) return;
    replaySelectedRound=roundOverride || available[available.length-1] || currentRound;
    const panel=document.getElementById("replayPanel");
    const slider=document.getElementById("replaySlider");
    const picks=document.getElementById("replayFocus");
    const rounds=document.getElementById("replayRounds");
    const hl=document.getElementById("replayHighlights");

    function renderReplayHighlights(){
      if(!hl) return;
      const markers=[...(highlightArchive[replaySelectedRound]||[])]
        .sort((a,b)=>b.importance-a.importance||a.t-b.t).slice(0,12);
      hl.innerHTML=markers.length
        ? markers.map((h,i)=>`<button class="highlight-jump" data-hi="${i}"><b>${highlightTypeLabel(h.type)}</b><span>${h.text}</span></button>`).join("")
        : `<span class="highlight-empty">자동 감지 하이라이트 없음</span>`;
      hl.querySelectorAll("[data-hi]").forEach(b=>{
        const h=markers[Number(b.dataset.hi)];
        b.addEventListener("click",()=>{
          replayFocusId=h.playerId??-1;
          replaySpeed=1;
          setReplayCursor(Math.max(0,h.t-1400));
        });
      });
    }

    if(rounds){
      rounds.innerHTML=available.map(r=>`<button data-replay-round="${r}">${r}R</button>`).join("");
      rounds.querySelectorAll("[data-replay-round]").forEach(b=>b.addEventListener("click",()=>{
        replaySelectedRound=Number(b.dataset.replayRound);
        replayPlaying=false;
        document.getElementById("replayPlay").textContent="▶ 재생";
        if(slider) slider.max=String(replayDuration());
        renderReplayHighlights();
        setReplayCursor(0);
      }));
    }

    if(slider){slider.max=String(replayDuration());slider.step="50";}
    if(picks){
      picks.innerHTML=`<button data-focus="-1">선두 자동</button>`+
        players.map(p=>`<button data-focus="${p.index}">${p.name}</button>`).join("");
      picks.querySelectorAll("[data-focus]").forEach(b=>b.addEventListener("click",()=>{
        replayFocusId=Number(b.dataset.focus);
        drawReplayFrame(replayFrameAt(replayCursor));
      }));
    }
    renderReplayHighlights();
    replaySpeed=1;
    setReplayCursor(seekMs==null?0:seekMs);
    panel.classList.remove("hidden");
  }


  // ============================================================
  // v1.8.0 ADAPTIVE SUBSTEP AI
  // Screen/game speed stays 1x. A 20ms simulation tick is split into
  // five 4ms internal steps only when an observer threatens a racer.
  // ============================================================

  function adaptiveSubsteps180(){
    let threat=false;
    let critical=false;

    for(const p of players){
      if(!p||p.done||p.dead)continue;

      const info=pathInfo120(p);
      const f=smoothFrame120(info,info.prog);
      const nx=-f.uy,ny=f.ux;

      // Direct scan is intentional here: it decides physics precision and must
      // not depend on a possibly stale spatial grid.
      for(const o of observers){
        const rx=o.x-p.x,ry=o.y-p.y;
        const d2=rx*rx+ry*ry;

        if(d2<30.25){ // 5.5 world units
          critical=true;
          threat=true;
          break;
        }

        if(d2>196)continue; // >14 units

        const fw=rx*f.ux+ry*f.uy;
        const lat=rx*nx+ry*ny;
        if(fw>-1.2&&fw<11.0&&Math.abs(lat)<4.8){
          threat=true;
        }
      }

      if(critical)break;
    }

    // v1.9.7: reduce CPU load.
    // Mild danger = 3x, critical close-range danger = 5x.
    if(critical)return 5;
    return threat?3:1;
  }
  function simulateStep(now,dt){
    dt=Math.max(0,Math.min(24,Number(dt)||0));

    const substeps=adaptiveSubsteps180();
    const subDt=dt/substeps;
    const startNow=now-dt;

    // Keep this visible for diagnostics/tuning.
    window.__adaptiveSubsteps180=substeps;

    for(let s=0;s<substeps;s++){
      const subNow=startNow+subDt*(s+1);

      updateObservers(subNow,subDt);
      if(gauntletMode190)gauntletStep190(subNow,subDt);

      // Invalidate nearby-observer caches every microstep because both racers
      // and observers have genuinely moved.
      playerNearbyFrameSerial++;

      // v1.9.2: refresh the spatial grid every danger microstep.
      if(substeps>1){
        rebuildObserverGrid();
      }

      for(let i=0;i<players.length;i++){
        sanitizeRaceState666(players[i]);

        // updatePlayer contains the planner + physical movement + swept collision.
        // Running it with 4ms dt means the AI can react again before traversing
        // the full distance of the former 20ms tick.
        updatePlayer(players[i],subNow,subDt);

        sanitizeRaceState666(players[i]);

        if(!Number.isFinite(players[i]._v120Prog)){
          stabilityAudit698(players[i],subNow);
        }
      }
    }

    // Periodic background work remains at normal simulation rate.
    simTickCounter++;
    if(simTickCounter===7)rebuildObserverGrid();
    if(simTickCounter>=14){
      simTickCounter=0;
      precomputeObserverPredictions(now);
    }

    if(currentMap770().id==='triple_diamond'){
      if(simTickCounter%2===0)telemetryStep696(now,dt*2);
    }else{
      if(league100?.phase!=="racing" || simTickCounter%2===0)telemetryStep696(now,dt*2);
    }

    // Visual/camera updates happen once, so the user still sees normal 1x speed.
    rebuildRaceFrameCache668(now);
    prevCamX730=camX;prevCamY730=camY;
    updateCamera(dt);
    if(gauntletMode190){recordGauntletProgress191();renderGauntletHud190(now);renderGauntletAnalytics191();}
    captureReplayFrame(now);
  }


  function loop(ts){
    if(!running) return;

    let frameDelta=ts-lastTs;
    lastTs=ts;
    diagFrameMs=frameDelta; diagMaxFrameMs=Math.max(diagMaxFrameMs,frameDelta); diagFrames++;
    if(!diagLastFpsTs) diagLastFpsTs=ts;
    if(ts-diagLastFpsTs>=1000){
      diagFps=diagFrames*1000/(ts-diagLastFpsTs);diagFrames=0;diagLastFpsTs=ts;
      updateFpsProtection(ts);
    }
    if(frameDelta<0) frameDelta=0;
    if(frameDelta>30) frameDelta=30;
    simAccumulator+=frameDelta;

    if(!simClock) simClock=ts-simAccumulator;

    let steps=0;
    while(simAccumulator>=SIM_STEP_MS && steps<MAX_SIM_STEPS){
      simClock+=SIM_STEP_MS;
      simulateStep(simClock,SIM_STEP_MS);
      simAccumulator-=SIM_STEP_MS;
      steps++;
    }

    // v1.2.4: never repay a browser hitch as visible fast-forward.
    if(steps>=MAX_SIM_STEPS && simAccumulator>=SIM_STEP_MS){
      // Drop old backlog completely. Leaving 95% of a step caused an alternating
      // 0-step/1-step cadence on some frame rates and looked like micro-stutter.
      simAccumulator=0;
    }else if(simAccumulator>SIM_STEP_MS){
      simAccumulator=0;
    }

    // v7.30 HOTFIX: simulation stays at 50 Hz; only visual coordinates interpolate.
    renderAlpha730=Math.max(0,Math.min(1,simAccumulator/SIM_STEP_MS));
    render(ts);

    const rankingInterval=fpsProtectLevel===0?320:fpsProtectLevel===1?430:560;
    if(ts-lastRankingRender>=rankingInterval){
      const rankingDt=ts-lastRankingRender;
      updateMatchRanks(rankingDt,simClock||ts);
      updateSectors(simClock||ts);
      renderRanking();
      const raceEvent=document.getElementById("raceEvent");
      if(raceEvent && ts>=raceEventUntil) raceEvent.classList.add("hidden");
      const leadBattle=document.getElementById("leadBattle");
      if(leadBattle){
        const battle=chooseBroadcastBattle();
        if(battle){
          const gap=Math.abs(currentProgress(battle.a)-currentProgress(battle.b));
          const secGap=gap/Math.max(1,battle.a.speed||1);
          leadBattle.textContent=`${battle.label} · ${battle.a.name} / ${battle.b.name} · ${secGap.toFixed(2)}s`;
          leadBattle.classList.remove("hidden");
          const battleKey=`${battle.label}:${battle.a.index}:${battle.b.index}`;
          if(battle.label==="CLOSE BATTLE" &&
             battleKey!==lastCloseBattleKey &&
             ts-lastCloseBattleEventAt>3000){
            pushRaceEvent(`CLOSE BATTLE · ${battle.a.name} / ${battle.b.name}`,ts);
            lastCloseBattleKey=battleKey;
            lastCloseBattleEventAt=ts;
          }
        }else leadBattle.classList.add("hidden");
      }
      const unitHud764=unitChassis764();
      cameraLabel.textContent=`${BUILD_ID} · ${currentMap770().name} · ${unitHud764.name} · 속도 x${unitHud764.topSpeed.toFixed(3)} · 크기 ${unitHud764.hitRadius.toFixed(2)} · 옵저버 ${observers.length}`;
      renderDiagnostics();
      // v3.2 upper broadcast/leader-change strip removed.
      lastRankingRender=ts;
    }

    const roundFinishers=players.filter(p=>p.done&&p.finishTime!=null).sort((a,b)=>a.finishTime-b.finishTime);

    // v1.0.2 TEAM LEAGUE: first clear wins the 1v1 heat immediately.
    if(league100?.phase==="racing"&&roundFinishers.length){
      running=false;
      finalizeIndividualClear([roundFinishers[0]],ts);
      return;
    }

    if(!isTeamMode()&&roundFinishers.length){
      running=false;finalizeIndividualClear(roundFinishers,ts);return;
    }
    if(players.every(p=>p.dead)){
      running=false;restartSameIndividualRound();return;
    }
    if(isTeamMode()&&league100?.phase!=="racing"&&players.every(p=>p.done)){
      const fin=[...players].sort((a,b)=>a.finishTime-b.finishTime);
      if(fin[0])commentaryLine(`round-finish-${currentRound}`,`${currentRound}라운드 종료! ${fin[0].name} 1위`,ts,true);
      running=false;finalizeRound();return;
    }
    raf=requestAnimationFrame(loop);
  }


  function getView(){
    const W=canvas.width,H=canvas.height;
    const fitScale=Math.min(W/MAP_W,H/MAP_H);
    const scale=fitScale*CAMERA_ZOOM;
    const viewW=W/scale, viewH=H/scale;
    const a=running?renderAlpha730:1;
    const rcx=lerp730(prevCamX730,camX,a);
    const rcy=lerp730(prevCamY730,camY,a);
    let sx=rcx-viewW/2, sy=rcy-viewH/2;
    sx=Math.max(0,Math.min(MAP_W-viewW,sx));
    sy=Math.max(0,Math.min(MAP_H-viewH,sy));
    return {sx,sy,viewW,viewH,scale};
  }

  const visibleObserverRender=[];
  function drawObservers(view){
    const pad=5;
    const minX=view.sx-pad, maxX=view.sx+view.viewW+pad;
    const minY=view.sy-pad, maxY=view.sy+view.viewH+pad;
    const r=Math.max(2.142,view.scale*0.72*OBS_VISUAL_SCALE);
    // v4.31: observer visual is circular again. Visual aspect ratio and collision
    // semantics are both symmetric; HIT remains controlled separately by PLAYER_HIT_RADIUS.
    const obsRx=r, obsRy=r;
    const lineW=Math.max(0.714,view.scale*.11*OBS_VISUAL_SCALE);

    // v2.31: use the already-maintained observer spatial grid for render culling.
    // We visit only buckets intersecting the camera instead of checking all 600.
    visibleObserverRender.length=0;
    // v2.40: one-cell render padding prevents edge flicker while still
    // avoiding a full 650-observer scan every frame.
    const gx0=Math.max(0,Math.floor(minX/OBS_GRID_SIZE)-1);
    const gx1=Math.min(OBS_GRID_COLS-1,Math.floor(maxX/OBS_GRID_SIZE)+1);
    const gy0=Math.max(0,Math.floor(minY/OBS_GRID_SIZE)-1);
    const gy1=Math.min(OBS_GRID_ROWS-1,Math.floor(maxY/OBS_GRID_SIZE)+1);
    for(let gy=gy0;gy<=gy1;gy++){
      for(let gx=gx0;gx<=gx1;gx++){
        const bucket=observerGrid[gy*OBS_GRID_COLS+gx];
        for(let bi=0;bi<bucket.length;bi++){
          const o=bucket[bi];
          if(o.x<minX||o.x>maxX||o.y<minY||o.y>maxY) continue;
          visibleObserverRender.push(o);
        }
      }
    }

    const obsRenderStep=fpsProtectLevel===0?1:fpsProtectLevel===1?2:3;
    ctx.beginPath();
    for(let vi=0;vi<visibleObserverRender.length;vi+=obsRenderStep){
      const o=visibleObserverRender[vi];
      const q730=renderObserverPos730(o);
      const x=(q730.x-view.sx)*view.scale;
      const y=(q730.y-view.sy)*view.scale;
      ctx.moveTo(x+obsRx,y);
      ctx.ellipse(x,y,obsRx,obsRy,0,0,Math.PI*2);
    }
    ctx.fillStyle="#d6e8ff";
    ctx.fill();
    ctx.strokeStyle="#5f89ad";
    ctx.lineWidth=lineW;
    ctx.stroke();

    ctx.beginPath();
    for(let vi=0;vi<visibleObserverRender.length;vi+=obsRenderStep){
      const o=visibleObserverRender[vi];
      const q730=renderObserverPos730(o);
      const x=(q730.x-view.sx)*view.scale;
      const y=(q730.y-view.sy)*view.scale;
      ctx.moveTo(x+r*.62,y);
      ctx.arc(x+r*.18,y,r*.28,0,Math.PI*2);
    }
    ctx.fillStyle="#83bcdf";
    ctx.fill();

    return Math.ceil(visibleObserverRender.length/obsRenderStep);
  }




  function drawPlayer(p,view,rank){
    const q730=renderPlayerPos730(p);
    const x=(q730.x-view.sx)*view.scale, y=(q730.y-view.sy)*view.scale;
    if(x<-80||y<-80||x>canvas.width+80||y>canvas.height+80) return;
    const unitVisual764=playerVisualScale764(p);
    const r=Math.max(7.25,view.scale*1.48*PLAYER_VISUAL_SCALE*unitVisual764);

    const now=gameNow();
    if(!Number.isFinite(p._renderLastX730)){p._renderLastX730=q730.x;p._renderLastY730=q730.y;}
    const mdx=q730.x-p._renderLastX730,mdy=q730.y-p._renderLastY730;
    if(mdx*mdx+mdy*mdy>0.000002){
      const targetAngle=Math.atan2(mdy,mdx)+Math.PI/2;
      let da=targetAngle-p.visualAngle;
      while(da>Math.PI) da-=Math.PI*2;
      while(da<-Math.PI) da+=Math.PI*2;
      const aa=1-Math.exp(-Math.max(1,diagFrameMs||16)/64);
      p.visualAngle+=da*aa;
      p._renderLastX730=q730.x;p._renderLastY730=q730.y;
    }

    ctx.save();
    ctx.translate(x,y);


    if(now<p.invUntil){
      ctx.globalAlpha=.48+.35*Math.abs(Math.sin(gameNow()*.018));
      ctx.strokeStyle="#fff";
      ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(0,0,r*1.45,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=1;
    }

    // v3.7 Marseille visual cue: short curved after-image + extra body rotation.
    // It is intentionally subtle and exists only while the real control is active.
    let marseilleVisualSpin=0;
    if(p.controlMode==="marseille" && now<p.marseilleUntil){
      const dur=Math.max(1,p.controlUntil-p.modeStart);
      const mt=Math.max(0,Math.min(1,(now-p.modeStart)/dur));
      marseilleVisualSpin=p.marseilleSide*Math.sin(mt*Math.PI)*1.05;
      ctx.save();
      ctx.globalAlpha=.16+.18*Math.sin(mt*Math.PI);
      ctx.strokeStyle=leagueTeamColor105(p);
      ctx.lineWidth=Math.max(2,r*.22);
      ctx.lineCap="round";
      ctx.beginPath();
      ctx.arc(-p.marseilleSide*r*.18,r*.10,r*(1.18+mt*.34),
        Math.PI*(.20+mt*.34),Math.PI*(1.02+mt*.74),p.marseilleSide<0);
      ctx.stroke();
      ctx.restore();
    }

    const spriteKey=p.spriteKey||RACER_KEYS[p.index]||"A";
    const sprite=unitSprites[currentRound]?.[spriteKey];
    if(sprite && sprite.complete && sprite.naturalWidth){
      const size=r*2.65;
      ctx.save();
      ctx.rotate(p.visualAngle+marseilleVisualSpin);
      ctx.shadowColor=leagueTeamColor105(p)||"rgba(255,255,255,.45)";
      ctx.shadowBlur=Math.max(2,r*.18);
      ctx.drawImage(sprite,-size/2,-size/2,size,size);
      // v1.42.0: sprite A is the RED-side asset and sprite B is the BLUE-side asset.
      // Do not paint a rectangular source-atop tint over the PNG; preserve the unit silhouette.
      ctx.restore();
    }else{
      // Sprite-load fallback stays team-colored; collision never changes the icon.
      ctx.fillStyle=leagueTeamColor105(p);
      ctx.strokeStyle="#07111a";
      ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();
    }

    // v1.42.0: keep the unit silhouette unobstructed. No rank badge or team-colour rectangle.
    // Nickname remains team-coloured above the sprite with a subtle text outline only.
    ctx.font=`900 ${Math.max(10,r*.82)}px system-ui`;
    ctx.textAlign="center";
    ctx.textBaseline="bottom";
    const label=p.name;
    const ly=-r*1.55;
    ctx.lineWidth=Math.max(2,r*.13);
    ctx.strokeStyle="rgba(3,7,12,.95)";
    ctx.strokeText(label,0,ly-2);
    ctx.fillStyle=leagueTeamColor105(p);
    ctx.fillText(label,0,ly-2);

    ctx.restore();
  }

  const renderOrder=[];

  function miniCrop770(){return currentMap770().miniCrop||{x:0,y:0,w:MAP_W,h:MAP_H};}
  let lastMiniMapRender=0;
  function renderMiniMap(force=false){
    const now=performance.now();
    const miniInterval=currentMap770().id==='triple_diamond'
      ? (fpsProtectLevel>=2?360:250)
      : (fpsProtectLevel>=2?200:125);
    if(!force&&now-lastMiniMapRender<miniInterval)return;
    lastMiniMapRender=now;
    const mc=document.getElementById("miniMap");
    if(!mc||!map.complete||map.naturalWidth<=0)return;
    const mx=mc.getContext("2d"),W=mc.width,H=mc.height;
    mx.clearRect(0,0,W,H);
    const MINI_CROP=miniCrop770();
    mx.globalAlpha=.78;
    mx.drawImage(map,MINI_CROP.x*MAP_IMAGE_SCALE_X,MINI_CROP.y*MAP_IMAGE_SCALE_Y,MINI_CROP.w*MAP_IMAGE_SCALE_X,MINI_CROP.h*MAP_IMAGE_SCALE_Y,0,0,W,H);
    mx.globalAlpha=1;
    const sx=W/MINI_CROP.w,sy=H/MINI_CROP.h;

    const zones775=safeZones770();
    const miniZone775=(z,color)=>{
      const x=(z.x0-MINI_CROP.x)*sx,y=(z.y0-MINI_CROP.y)*sy;
      const w=(z.x1-z.x0)*sx,h=(z.y1-z.y0)*sy;
      mx.save();mx.strokeStyle=color;mx.lineWidth=1.8;
      mx.strokeRect(x,y,w,h);mx.restore();
    };
    const smx=(zones775.start.x0+zones775.start.x1)*.5,smy=(zones775.start.y0+zones775.start.y1)*.5;
    const gmx=(zones775.goal.x0+zones775.goal.x1)*.5,gmy=(zones775.goal.y0+zones775.goal.y1)*.5;
    const shared778=!!currentMap770().sharedGate778 || Math.hypot(smx-gmx,smy-gmy)<.75;
    if(shared778){
      if(!currentMap770().hideRuntimeSharedGate7992) miniZone775(zones775.start,"#ff3b3b");
    }else{
      miniZone775(zones775.start,"#ffd92f");
      miniZone775(zones775.goal,"#39ff6a");
    }

    for(let i=0;i<players.length;i++){
      const p=players[i];
      if(p.dead) continue;
      const x=(p.x-MINI_CROP.x)*sx,y=(p.y-MINI_CROP.y)*sy;
      if(x<0||y<0||x>W||y>H) continue;
      mx.beginPath();mx.arc(x,y,2.45,0,Math.PI*2);
      mx.fillStyle=p.color;mx.fill();
      mx.lineWidth=.75;mx.strokeStyle="rgba(0,0,0,.92)";mx.stroke();
    }
  }

  function drawAIPOVOverlay(view){
    if(povPlayerIndex<0) return;
    const p=players[povPlayerIndex]; if(!p) return;
    const now=gameNow();
    const sx=x=>(x-view.sx)*view.scale, sy=y=>(y-view.sy)*view.scale;
    ctx.save();
    // Genuine held virtual-mouse target.
    const tx=sx(p.mouseTargetX), ty=sy(p.mouseTargetY);
    const q730=renderPlayerPos730(p);
    ctx.setLineDash([8,7]); ctx.lineWidth=2; ctx.strokeStyle='rgba(255,255,255,.88)';
    ctx.beginPath(); ctx.moveTo(sx(q730.x),sy(q730.y)); ctx.lineTo(tx,ty); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(tx,ty,8,0,Math.PI*2); ctx.strokeStyle='#fff'; ctx.lineWidth=3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx-12,ty);ctx.lineTo(tx+12,ty);ctx.moveTo(tx,ty-12);ctx.lineTo(tx,ty+12);ctx.stroke();
    // Actual click log: recent commands only, never reconstructed from movement.
    const logs=Array.isArray(p.mouseClickLog)?p.mouseClickLog:[];
    for(let i=Math.max(0,logs.length-10);i<logs.length;i++){
      const c=logs[i], age=now-c.t; if(age>2600) continue;
      const a=Math.max(.18,1-age/2600), cx=sx(c.x),cy=sy(c.y);
      ctx.globalAlpha=a; ctx.beginPath();ctx.arc(cx,cy,4.5,0,Math.PI*2);ctx.fillStyle='#ffe36e';ctx.fill();
    }
    ctx.globalAlpha=1;
    // Only observers present in this player's perception memory are highlighted.
    if(p.perceivedObservers){
      for(const m of p.perceivedObservers.values()){
        const age=now-m.lastSeen; if(age>900 || now<(m.awareAt||0)) continue;
        const cx=sx(m.x),cy=sy(m.y); ctx.beginPath();ctx.arc(cx,cy,12,0,Math.PI*2);
        ctx.strokeStyle=(m.id===p.liveEvadeThreat)?'#ff6969':'#69e7ff';ctx.lineWidth=(m.id===p.liveEvadeThreat)?4:2;ctx.stroke();
      }
    }
    ctx.globalAlpha=1;
    const state=p.reactionDangerActive && now<(p.mouseReactionReadyAt||0)?'반응 대기':(p.mouseMode||'race');
    const lines=[`${p.name} AI POV`, `행동 ${state} · 클릭 #${p.mouseClickSeq||0}`, `위협 OBS ${p.liveEvadeThreat>=0?p.liveEvadeThreat:'--'} · 반응 ${Math.round(p.lastReactionDelayMs||0)}ms`, `흰 십자=현재 실제 클릭 · 노란점=최근 실제 클릭 · 청록원=인지 OBS`];
    ctx.font='600 18px system-ui,sans-serif'; const boxW=520,boxH=100;
    ctx.fillStyle='rgba(5,10,18,.76)';ctx.fillRect(18,18,boxW,boxH);
    lines.forEach((t,i)=>{ctx.fillStyle=i===0?'#fff':'#d9e7f5';ctx.fillText(t,32,43+i*21);});
    ctx.restore();
  }

  function drawStartFinish775(view){
    if(!view)return;
    const zones=safeZones770();
    const drawZone=(z,color,fill=false)=>{
      const x=(z.x0-view.sx)*view.scale,y=(z.y0-view.sy)*view.scale;
      const w=(z.x1-z.x0)*view.scale,h=(z.y1-z.y0)*view.scale;
      if(x+w<0||y+h<0||x>canvas.width||y>canvas.height)return;
      ctx.save();
      if(fill){
        ctx.fillStyle="rgba(255,38,38,.72)";
        ctx.fillRect(x,y,w,h);
      }
      ctx.strokeStyle=color;
      ctx.lineWidth=Math.max(2.5,Math.min(6,view.scale*.75));
      ctx.shadowColor=color;ctx.shadowBlur=Math.max(2,view.scale*.7);
      ctx.strokeRect(x,y,w,h);
      ctx.restore();
    };
    const scx=(zones.start.x0+zones.start.x1)*.5,scy=(zones.start.y0+zones.start.y1)*.5;
    const gcx=(zones.goal.x0+zones.goal.x1)*.5,gcy=(zones.goal.y0+zones.goal.y1)*.5;
    const sameGate778=!!currentMap770().sharedGate778 || Math.hypot(scx-gcx,scy-gcy)<.75;
    if(sameGate778){
      if(!currentMap770().hideRuntimeSharedGate7992) drawZone(zones.start,"#ff3b3b",false);
    }else{
      drawZone(zones.start,"#ffd92f");
      drawZone(zones.goal,"#39ff6a");
    }
  }

  function render(ts){
    const W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);
    if(!map.complete||map.naturalWidth<=0) return;

    const view=getView();
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality=currentMap770().id==='triple_diamond'?"medium":"high";
    ctx.drawImage(map,view.sx*MAP_IMAGE_SCALE_X,view.sy*MAP_IMAGE_SCALE_Y,view.viewW*MAP_IMAGE_SCALE_X,view.viewH*MAP_IMAGE_SCALE_Y,0,0,W,H);
    drawStartFinish775(view);

    // v2.07: cull + batch all visible observers into a few canvas paths.
    // This sharply reduces per-observer draw calls while preserving their look.
    const visibleObs=drawObservers(view);

    renderOrder.length=0;
    for(let i=0;i<players.length;i++) renderOrder.push(players[i]);
    renderOrder.sort((a,b)=>currentProgress(b)-currentProgress(a));
    for(let i=0;i<renderOrder.length;i++){
      const rp=renderOrder[i];
      if(!rp.dead || gameNow()<rp.hitFxUntil) drawPlayer(rp,view,i+1);
    }
    drawAIPOVOverlay(view);

    const elapsed=raceStart ? Math.max(0,(simClock||ts||performance.now())-raceStart) : 0;
    clockEl.textContent=formatTime(elapsed);
    lastVisibleObs=visibleObs;
    renderMiniMap();
  }

  const RECORD_KEY="observerFM_v27_records";

  function blankRecordBook(){
    const playersRec={}; for(const n of names) playersRec[n]=null;
    return {map:null,mapName:"",players:playersRec};
  }
  function loadRecordBook(){
    try{
      const raw=JSON.parse(localStorage.getItem(RECORD_KEY)||"null")||blankRecordBook();
      const base=blankRecordBook();
      base.map=Number.isFinite(raw.map)?raw.map:null;
      base.mapName=raw.mapName||"";
      for(const n of names){
        const v=raw.players&&raw.players[n];
        base.players[n]=Number.isFinite(v)?v:null;
      }
      return base;
    }catch(e){ return blankRecordBook(); }
  }
  function saveRecordBook(book){try{localStorage.setItem(RECORD_KEY,JSON.stringify(book));}catch(e){}}
  function registerFinishRecord(p,timeMs){
    const book=loadRecordBook();
    const oldPB=book.players[p.name];
    p.newPB=oldPB==null || timeMs<oldPB;
    if(p.newPB) book.players[p.name]=timeMs;
    p.newMapRecord=book.map==null || timeMs<book.map;
    if(p.newMapRecord){book.map=timeMs;book.mapName=p.name;}
    saveRecordBook(book);
    renderRecordBoard();
  }
  function renderRecordBoard(){
    const el=document.getElementById("recordBoard"); if(!el)return;
    const book=loadRecordBook();
    const leader=[...players].sort((a,b)=>currentProgress(b)-currentProgress(a))[0];
    const leaderPB=leader?book.players[leader.name]:null;
    el.innerHTML=`<div><span>맵 최고기록</span><b>${book.map==null?"--":formatTime(book.map)}</b><small>${book.mapName||""}</small></div>
      <div><span>선두 PB</span><b>${leaderPB==null?"--":formatTime(leaderPB)}</b><small>${leader?leader.name:""}</small></div>`;
  }

  let prevRanks=new Map();
  const SEASON_KEY="observerFM_v31_season";
  let seasonRecorded=false;

  function blankSeasonRow(){
    return {starts:0,wins:0,top3:0,finishes:0,totalRank:0,totalTime:0,bestTime:null,
      collisions:0,stops:0,avoids:0,overtakes:0,leadMs:0,distance:0,nearMisses:0,extremeNearMisses:0,dangerExposureMs:0,totalRating:0,cleanRaces:0};
  }

  function loadSeason(){
    try{
      const data=JSON.parse(localStorage.getItem(SEASON_KEY)||"{}");
      for(const n of names){if(!data[n])data[n]=blankSeasonRow();else data[n]=Object.assign(blankSeasonRow(),data[n]);}
      return data;
    }catch(e){
      const data={}; for(const n of names) data[n]=blankSeasonRow(); return data;
    }
  }

  function saveSeason(data){
    try{ localStorage.setItem(SEASON_KEY,JSON.stringify(data)); }catch(e){}
  }

  function recordSeasonResults(){if(seasonRecorded||roundHistory.length<5)return;const season=loadSeason();for(const round of roundHistory)for(const x of round.players){const s=season[x.name]||blankSeasonRow();s.starts++;s.totalRank+=x.rank;s.finishes++;if(x.rank===1)s.wins++;if(x.rank<=3)s.top3++;s.totalTime+=x.time||0;s.bestTime=s.bestTime==null?x.time:Math.min(s.bestTime,x.time);s.collisions+=x.collisions||0;if(!x.collisions)s.cleanRaces++;s.avoids+=x.avoids||0;s.overtakes+=x.overtakes||0;s.leadMs+=x.leadMs||0;s.distance+=x.distance||0;s.nearMisses+=x.nearMisses||0;s.extremeNearMisses+=x.extremeNearMisses||0;s.dangerExposureMs+=x.dangerExposureMs||0;s.totalRating+=x.rating||0;season[x.name]=s;}saveSeason(season);seasonRecorded=true;renderEloRanking();}

  function eloMetrics(s){const n=Math.max(1,s.starts||0),avgRank=(s.totalRank||0)/n,rankPower=(12-avgRank)/11,winRate=(s.wins||0)/n,top3Rate=(s.top3||0)/n,avgRating=(s.totalRating||0)/n,avoid=(s.avoids||0)/Math.max(1,(s.avoids||0)+(s.collisions||0)),nm=Math.min(1,(s.nearMisses||0)/(n*12)),ov=Math.min(1,(s.overtakes||0)/(n*4)),clean=(s.cleanRaces||0)/n,lead=Math.min(1,(s.leadMs||0)/(n*18000));const power=rankPower*.55+(winRate*.55+top3Rate*.45)*.14+Math.max(0,Math.min(1,(avgRating-4)/6))*.09+(avoid*.68+nm*.32)*.09+ov*.05+clean*.05+lead*.03;return{avgRank,winRate,top3Rate,avgRating,avoid,elo:Math.round(1000+power*1000)}}
  function renderEloRanking(){const box=document.getElementById("eloRankingList");if(!box)return;const s=loadSeason(),rows=names.map(name=>({name,s:s[name],m:eloMetrics(s[name])})).sort((a,b)=>b.m.elo-a.m.elo||a.m.avgRank-b.m.avgRank);box.innerHTML=rows.map((r,i)=>`<div class="elo-row"><div class="elo-rank">${i+1}</div><div class="elo-name"><b>${r.name}</b><small>${styleLabel(drivingStyles[names.indexOf(r.name)].style)}</small></div><div class="elo-score">${r.m.elo}</div><div class="elo-data">평균 ${r.s.starts?r.m.avgRank.toFixed(2):"--"}위 · ${r.s.starts}경기 · 승률 ${(r.m.winRate*100).toFixed(1)}% · 상위3 ${(r.m.top3Rate*100).toFixed(1)}%<br>평점 ${r.s.starts?r.m.avgRating.toFixed(2):"--"} · 회피율 ${(r.m.avoid*100).toFixed(1)}% · 아슬회피 ${r.s.nearMisses||0} · 충돌 ${r.s.collisions||0} · 추월 ${r.s.overtakes||0}</div></div>`).join("")}

  function resetSeason(){
    if(!confirm("시즌 누적 기록을 전부 초기화할까요?")) return;
    localStorage.removeItem(SEASON_KEY);
    alert("시즌 기록을 초기화했습니다.");
  }



  function chooseBroadcastBattle(){
    const ranks=players.filter(p=>!p.done)
      .map(p=>({p,prog:currentProgress(p)}))
      .sort((a,b)=>b.prog-a.prog);
    if(ranks.length<2) return null;

    let best=null,bestScore=-999;
    for(let i=0;i<ranks.length-1;i++){
      const a=ranks[i], b=ranks[i+1];
      const gap=a.prog-b.prog;
      if(gap>2.15) continue;
      const closeScore=Math.max(0,2.15-gap)*2.0;
      const rankScore=i===0?2.5:i<3?1.2:.35;
      const finishScore=a.prog>routeLength*.90?4.0:0;
      const recentAttack=Math.min(1.5,((a.p.match.overtakes||0)+(b.p.match.overtakes||0))*.10);
      const score=closeScore+rankScore+finishScore+recentAttack;
      if(score>bestScore){
        bestScore=score;
        best={a:a.p,b:b.p,label:i===0?(a.prog>routeLength*.90?"FINISH BATTLE":"LEAD BATTLE"):"CLOSE BATTLE"};
      }
    }
    if(!best && ranks[0].prog>routeLength*.93){
      return {a:ranks[0].p,b:ranks[1].p,label:"FINISH BATTLE"};
    }
    return best;
  }

  function highlightTypeLabel(type){
    const labels={
      PHOTO_FINISH:"초접전 결승",MULTIPASS:"연속 추월",OVERTAKE:"추월",
      LEAD_CHANGE:"선두 변경",COMEBACK:"대역전",BACKCON:"빽컨 회피",
      STOPCON:"스탑컨 회피",COLLISION:"옵저버 충돌",FINISH:"완주",WIN:"우승",CLEAN:"무충돌",
      BEST_SECTOR:"최고 구간기록",
      FOLLOWER_SAVE:"연쇄 생존 회피",
      MARSEILLE:"마르세유턴"
    };
    return labels[type]||String(type||"").replaceAll("_"," ");
  }

  function addAutoHighlight(type,text,now=gameNow(),playerId=-1,importance=1){
    if(!raceStart) return;
    const t=Math.max(0,now-raceStart);
    const last=highlightMarkers[highlightMarkers.length-1];
    if(last && last.type===type && last.playerId===playerId && t-last.t<1200) return;
    highlightMarkers.push({type,text,t,playerId,importance});
    if(highlightMarkers.length>40) highlightMarkers.shift();
  }

  function pushRaceEvent(text,now=gameNow(),playerId=-1,type="EVENT"){
    raceEventText=text;raceEventUntil=now+1600;
    const t=raceStart?Math.max(0,now-raceStart):0;
    liveEventFeed814.unshift({text,time:t,playerId,type});
    if(liveEventFeed814.length>6)liveEventFeed814.length=6;
    if(playerId>=0&&players[playerId]){
      liveFocus814={playerId,type,text,until:now+4200};
    }
  }

  function updateSectors(now){
    if(!raceStart) return;
    for(let i=0;i<players.length;i++){
      const p=players[i];
      if(p.done || p.sectorIndex>=SECTOR_MARKS.length) continue;
      const frac=Math.max(0,Math.min(1,currentProgress(p)/routeLength));
      while(p.sectorIndex<SECTOR_MARKS.length && frac>=SECTOR_MARKS[p.sectorIndex]){
        const elapsed=now-raceStart;
        const sectorMs=elapsed-p.sectorStartMs;
        p.sectorTimes[p.sectorIndex]=sectorMs;
        const si=p.sectorIndex;
        p.sectorStartMs=elapsed;
        p.sectorIndex++;
        if(!bestSector[si] || sectorMs<bestSector[si].time){
          bestSector[si]={name:p.name,time:sectorMs};
          pushRaceEvent(`최고 구간기록 ${si+1} · ${p.name} ${formatTime(sectorMs)}`,now,p.index,"BEST_SECTOR");
        }
      }
    }
  }

  function updateMatchRanks(dt,now=gameNow()){
    const ordered=[...players].sort((a,b)=>currentProgress(b)-currentProgress(a));
    ordered.forEach((p,idx)=>{
      const rank=idx+1;
      p.match.bestRank=Math.min(p.match.bestRank,rank);
      p.match.worstRank=Math.max(p.match.worstRank,rank);
      p.match.maxRankGain=Math.max(p.match.maxRankGain,p.match.startRank-rank);
      p.match.maxRankLoss=Math.max(p.match.maxRankLoss,rank-p.match.startRank);
      const prev=prevRanks.get(p.index);
      if(prev!=null && rank<prev){
        const gained=prev-rank;
        p.match.overtakes += gained;
        if(gained>=1){
          pushRaceEvent(`OVERTAKE · ${p.name} ${prev}위 → ${rank}위`,now,p.index,"OVERTAKE");
          raceTotalOvertakes+=gained;
          addAutoHighlight(gained>=2?"MULTIPASS":"OVERTAKE",
            `${p.name} · ${prev}위 → ${rank}위${gained>=2?" 연속 추월":""}`,
            now,p.index,gained>=2?2:1);
          // v2.06: overtake events are shown in the HUD only; camera remains leader-focused.
        }
      }
      prevRanks.set(p.index,rank);
    });
    if(ordered[0] && !ordered[0].done){
      ordered[0].match.leadMs += dt;
      if(lastLeaderName && lastLeaderName!==ordered[0].name){
        raceLeaderChanges++;
        const oldLeader=lastLeaderName;
        pushRaceEvent(`NEW LEADER · ${ordered[0].name}`,now,ordered[0].index,"LEAD_CHANGE");

        addAutoHighlight("LEAD_CHANGE",`NEW LEADER · ${ordered[0].name}`,now,ordered[0].index,2);
      }
      lastLeaderName=ordered[0].name;
    }
  }


  let lastLiveStatsRender=0;




  const rankRowCache=new Map();








  function renderRanking(){
    if(!league100)return;
    const now115=performance.now();
    if(now115<(renderRanking._next115||0))return;
    renderRanking._next115=now115+80;
    renderLeagueSide100();
  }



  function statLabel(k){
    const labels={pace:"속도",acceleration:"가속",cornering:"코너링",insideLine:"인코스",routeReading:"루트판단",
      avoidance:"회피",reaction:"반응속도",prediction:"예측",control:"컨트롤",stability:"안정성",braking:"브레이킹",
      recovery:"회복",consistency:"일관성",focus:"집중력",aggression:"공격성",riskControl:"리스크관리",
      pressure:"압박대응",start:"스타트",endurance:"지구력",luck:"운"};
    return labels[k]||k;
  }

  function styleLabel(style){
    const labels={apexHunter:"인코스 공격형",safeReader:"안전 예측형",attacker:"공격형",lineMaster:"최단라인형",
      balanced:"밸런스형",controller:"컨트롤형",patient:"신중형",opportunist:"기회포착형"};
    return labels[style]||style;
  }


  const avatarCache=new Map();
  const avatarHair=["#dfe9ff","#161b2b","#8b2530","#d7a15b","#24415f","#e56c42","#593866","#2c3146"];
  const avatarSkin=["#f0c7a6","#d8a47f","#edc2a4","#c98f6b","#e4b38e","#bc8566","#efc7a8","#d69c78"];

  function playerAvatar(index){
    if(avatarCache.has(index)) return avatarCache.get(index);
    const name=names[index]||"?";
    const hair=avatarHair[index%avatarHair.length], skin=avatarSkin[index%avatarSkin.length];
    const accent=colors[index%colors.length];
    const initials=name.slice(0,2).toUpperCase();
    const fringe=index%4;
    const hairPath=[
      "M18 33 Q25 5 52 10 Q78 8 83 35 Q72 24 60 27 Q46 13 18 33Z",
      "M15 34 Q18 7 50 9 Q80 10 84 36 Q70 20 58 24 L52 12 L45 28 Q30 20 15 34Z",
      "M16 33 Q26 4 55 9 Q76 10 84 35 Q67 24 57 30 Q50 16 43 31 Q28 23 16 33Z",
      "M17 35 Q22 8 51 8 Q78 8 84 35 L66 25 L58 13 L49 30 L38 17 L30 31Z"
    ][fringe];
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#09111c"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs>
      <rect width="96" height="96" rx="18" fill="url(#g)"/>
      <circle cx="48" cy="42" r="25" fill="${skin}"/>
      <path d="${hairPath}" fill="${hair}"/>
      <path d="M27 45 Q35 40 41 44" fill="none" stroke="#18202c" stroke-width="2" stroke-linecap="round"/>
      <path d="M55 44 Q62 40 69 45" fill="none" stroke="#18202c" stroke-width="2" stroke-linecap="round"/>
      <circle cx="36" cy="47" r="2.6" fill="#15202d"/><circle cx="61" cy="47" r="2.6" fill="#15202d"/>
      <path d="M42 58 Q48 62 55 58" fill="none" stroke="#8c5148" stroke-width="2" stroke-linecap="round"/>
      <path d="M20 96 Q23 70 48 70 Q73 70 78 96Z" fill="${accent}" opacity=".88"/>
      <circle cx="48" cy="48" r="43" fill="none" stroke="${accent}" stroke-width="3" opacity=".55"/>
      <text x="48" y="89" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="800" fill="white">${initials}</text>
    </svg>`;
    const uri="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
    avatarCache.set(index,uri);
    return uri;
  }

  function avatarHtml(index,cls="player-avatar"){
    const name=names[index]||"선수";
    return `<img class="${cls}" src="${playerAvatar(index)}" alt="${name} 캐릭터">`;
  }

  function overallOf(p){
    const vals=Object.values(p.stats);
    return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
  }

  
  const UNIT_STATS_KEY_769="observerFM.unitStats.v769";
  function blankUnitStats769(round){
    const u=unitChassis764(round);
    return {key:u.key,name:u.name,races:0,playerStarts:0,wins:0,top3:0,finishes:0,
      rankSum:0,timeSum:0,timeN:0,collisions:0,evades:0,evadeSuccess:0,
      lineEffSum:0,insideAccSum:0};
  }
  function loadUnitStats769(){
    try{return JSON.parse(localStorage.getItem(UNIT_STATS_KEY_769)||"{}")||{};}catch(e){return {};}
  }
  function saveUnitStats769(v){
    try{localStorage.setItem(UNIT_STATS_KEY_769,JSON.stringify(v));}catch(e){}
  }
  function recordUnitRound769(result){
    if(!result?.players)return;
    const round=result.round||currentRound,u=unitChassis764(round);
    const db=loadUnitStats769(),r=db[u.key]||blankUnitStats769(round);
    r.races++;
    for(const x of result.players){
      const a=x.analytics749?.advanced||{};
      r.playerStarts++;r.wins+=x.rank===1?1:0;r.top3+=x.rank<=3?1:0;
      const finished=Number.isFinite(x.time);
      if(finished){r.finishes++;r.timeSum+=x.time;r.timeN++;}
      r.rankSum+=x.rank;r.collisions+=x.collisions||0;
      r.evades+=a.avoidanceCount||0;r.evadeSuccess+=a.avoidanceSuccess||0;
      r.lineEffSum+=a.racingLineEfficiency||0;r.insideAccSum+=a.insideLineAccuracy||0;
    }
    db[u.key]=r;saveUnitStats769(db);
  }
  function unitStats769(){
    const db=loadUnitStats769();
    return Object.keys(UNIT_CHASSIS_764).map(k=>{
      const u=UNIT_CHASSIS_764[k],r=db[u.key]||blankUnitStats769(+k),n=Math.max(1,r.playerStarts);
      return {...r,
        winRate:r.wins/n,top3Rate:r.top3/n,finishRate:r.finishes/n,avgRank:r.rankSum/n,
        avgTime:r.timeN?r.timeSum/r.timeN:null,
        evadeSuccessRate:r.evades?r.evadeSuccess/r.evades:0,
        avgLineEfficiency:r.lineEffSum/n,avgInsideAccuracy:r.insideAccSum/n,
        chassis:{...u}};
    });
  }

  const ANALYTICS_KEY_749="observerFM.analytics.v749";
  function blankAnalytics749(){
    return {races:0,wins:0,top3:0,finishes:0,rankSum:0,ratingSum:0,
      threats:0,evades:0,evadeSuccess:0,collisions:0,overtakes:0,leadMs:0,
      lineEffSum:0,insideAccSum:0,reactionSum:0,reactionN:0,rejoinSum:0,rejoinN:0,
      actionCounts:{side:0,thread:0,diag:0,hard:0,brake:0,stop:0,backcon:0},
      sectors:Array.from({length:6},()=>({races:0,timeSum:0,threats:0,evades:0,lineDevSum:0,lineN:0})),
      recent:[]};
  }
  function loadAnalytics749(){
    try{return JSON.parse(localStorage.getItem(ANALYTICS_KEY_749)||"{}")||{};}catch(e){return {};}
  }
  function saveAnalytics749(v){
    try{localStorage.setItem(ANALYTICS_KEY_749,JSON.stringify(v));}catch(e){}
  }
  function recordAnalyticsRound749(result){
    if(!result?.players)return;
    const db=loadAnalytics749();
    for(const x of result.players){
      const r=db[x.name]||blankAnalytics749();
      const a=x.analytics749?.advanced||{};
      r.races++;r.wins+=x.rank===1?1:0;r.top3+=x.rank<=3?1:0;r.finishes+=x.time!=null?1:0;
      r.rankSum+=x.rank;r.ratingSum+=x.rating||0;r.collisions+=x.collisions||0;
      r.overtakes+=x.overtakes||0;r.leadMs+=a.leaderMs||x.leadMs||0;
      r.threats+=a.threatReads||0;r.evades+=a.avoidanceCount||0;r.evadeSuccess+=a.avoidanceSuccess||0;
      r.lineEffSum+=a.racingLineEfficiency||0;r.insideAccSum+=a.insideLineAccuracy||0;
      if(a.avgReactionMs!=null){r.reactionSum+=a.avgReactionMs;r.reactionN++;}
      if(a.avgRejoinMs!=null){r.rejoinSum+=a.avgRejoinMs;r.rejoinN++;}
      for(const [k,v] of Object.entries(a.actionCounts||{}))r.actionCounts[k]=(r.actionCounts[k]||0)+(v||0);
      (a.sectors||[]).forEach((s,i)=>{
        if(!r.sectors[i])r.sectors[i]={races:0,timeSum:0,threats:0,evades:0,lineDevSum:0,lineN:0};
        const q=r.sectors[i];q.races++;q.timeSum+=s.timeMs||0;q.threats+=s.threats||0;q.evades+=s.evades||0;
        if(s.avgLineDeviation!=null){q.lineDevSum+=s.avgLineDeviation;q.lineN++;}
      });
      r.recent.push({round:result.round,rank:x.rank,time:x.time,rating:x.rating,
        collisions:x.collisions,evadeRate:a.avoidanceSuccessRate||0,at:Date.now()});
      if(r.recent.length>10)r.recent=r.recent.slice(-10);
      db[x.name]=r;
    }
    saveAnalytics749(db);
  }
  function careerAnalytics749(name){
    const r=loadAnalytics749()[name]||blankAnalytics749(),n=Math.max(1,r.races);
    return {
      ...r,winRate:r.wins/n,top3Rate:r.top3/n,finishRate:r.finishes/n,avgRank:r.rankSum/n,
      avgRating:r.ratingSum/n,evadeSuccessRate:r.evades?r.evadeSuccess/r.evades:0,
      avgLineEfficiency:r.lineEffSum/n,avgInsideAccuracy:r.insideAccSum/n,
      avgReactionMs:r.reactionN?r.reactionSum/r.reactionN:null,
      avgRejoinMs:r.rejoinN?r.rejoinSum/r.rejoinN:null
    };
  }
  function analyticsProfileHtml749(p){
    const live=playerAnalytics749(p),a=live.advanced||{},career=careerAnalytics749(p.name);
    const actions=a.actionCounts||{};
    const sectorRows=(a.sectors||[]).map(s=>`<tr><td>${s.name}</td><td>${(s.timeMs/1000).toFixed(2)}s</td>
      <td>${s.threats}</td><td>${s.evades}</td><td>${s.avgLineDeviation.toFixed(2)}</td>
      <td>${s.minObserverGap==null?"-":s.minObserverGap.toFixed(2)}</td></tr>`).join("");
    const recent=(career.recent||[]).slice().reverse().map(x=>
      `<span>${x.rank}위 · ${x.time==null?"사망":formatTime(x.time)} · ${Number(x.rating||0).toFixed(1)}</span>`).join("");
    const p759=personalitySummary759(p);
    return `<div class="seasonBox analytics749">
      <h3>v7.59 경기력 · 개성 분석</h3>
      <div class="seasonGrid">
        <div><span>시그니처</span><b>${p759.signature}</b></div>
        <div><span>개성 영향도</span><b>${Math.round(p759.personalityAuthority*100)}%</b></div>
        <div><span>공격 성향</span><b>${Math.round(p759.aggression*100)}</b></div>
        <div><span>위험 관리</span><b>${Math.round(p759.caution*100)}</b></div>
      </div>
      <div class="seasonGrid">
        <div><span>실전 스타일</span><b>${live.styles.length?live.styles.join(" · "):"데이터 수집 중"}</b></div>
        <div><span>회피 성공률</span><b>${(100*(a.avoidanceSuccessRate||0)).toFixed(1)}%</b></div>
        <div><span>평균 반응</span><b>${a.avgReactionMs==null?"-":a.avgReactionMs.toFixed(0)+"ms"}</b></div>
        <div><span>라인 효율</span><b>${(100*(a.racingLineEfficiency||0)).toFixed(1)}%</b></div>
        <div><span>인코스 정확도</span><b>${(100*(a.insideLineAccuracy||0)).toFixed(1)}%</b></div>
        <div><span>최소 옵저버 간격</span><b>${a.minObserverGap==null?"-":a.minObserverGap.toFixed(2)}</b></div>
        <div><span>옆/대각/스레드</span><b>${(actions.side||0)+(actions.diag||0)+(actions.thread||0)}회</b></div>
        <div><span>빽컨</span><b>${actions.backcon||0}회</b></div>
        <div><span>강한 구간</span><b>${live.strongestSector||"-"}</b></div>
        <div><span>취약 구간</span><b>${live.weakestSector||"-"}</b></div>
      </div>
      <h3>구간 분석</h3>
      <div class="tableWrap"><table class="resultTable"><thead><tr><th>구간</th><th>시간</th><th>위협</th><th>회피</th><th>라인이탈</th><th>최소간격</th></tr></thead>
      <tbody>${sectorRows}</tbody></table></div>
      <h3>누적 분석</h3>
      <div class="seasonGrid">
        <div><span>분석 경기</span><b>${career.races}</b></div>
        <div><span>우승률</span><b>${(100*career.winRate).toFixed(1)}%</b></div>
        <div><span>완주율</span><b>${(100*career.finishRate).toFixed(1)}%</b></div>
        <div><span>평균 순위</span><b>${career.avgRank.toFixed(2)}</b></div>
        <div><span>누적 회피율</span><b>${(100*career.evadeSuccessRate).toFixed(1)}%</b></div>
        <div><span>누적 평균평점</span><b>${career.avgRating.toFixed(2)}</b></div>
      </div>
      <div class="analytics-recent">${recent||"<span>최근 경기 없음</span>"}</div>
    </div>`;
  }

function seasonCardHtml(p){
    const s=loadSeason()[p.name]||blankSeasonRow();
    const pb=loadRecordBook().players[p.name];
    if(!s.starts) return `<div class="seasonBox"><h3>시즌 기록</h3><p>개인 최고기록 ${pb==null?"-":formatTime(pb)}</p></div>`;
    const avgRank=s.totalRank/s.starts;
    const finishRate=s.finishes/s.starts*100;
    const avgTime=s.finishes ? s.totalTime/s.finishes : 0;
    const avgCollision=s.collisions/s.starts;
    return `<div class="seasonBox">
      <h3>시즌 누적 기록</h3>
      <div class="seasonGrid">
        <div><span>출전</span><b>${s.starts}</b></div>
        <div><span>우승</span><b>${s.wins}</b></div>
        <div><span>상위 3위</span><b>${s.top3}</b></div>
        <div><span>평균 순위</span><b>${avgRank.toFixed(2)}</b></div>
        <div><span>완주율</span><b>${finishRate.toFixed(1)}%</b></div>
        <div><span>평균 기록</span><b>${formatTime(avgTime)}</b></div>
        <div><span>개인 최고기록</span><b>${pb==null?"-":formatTime(pb)}</b></div>
        <div><span>경기당 충돌</span><b>${avgCollision.toFixed(2)}</b></div>
        <div><span>총 추월</span><b>${s.overtakes}</b></div>
        <div><span>선두 시간</span><b>${(s.leadMs/1000).toFixed(1)}s</b></div>
      </div>
    </div>`;
  }

  function identitySummary(p){
    const s=p.drivingStyle.style;
    if(s==="apexHunter") return "극인코스/공격적 코너 공략";
    if(s==="safeReader") return "안전거리/옵저버 예측 우선";
    if(s==="attacker") return "빠른 추월판단/빽컨 선호";
    if(s==="lineMaster") return "레이싱라인/코너 정밀도 우선";
    if(s==="controller") return "컨트롤 대응/지그재그 회피 선호";
    if(s==="patient") return "기다렸다 추월/외곽 안전라인";
    if(s==="opportunist") return "빈틈 포착/순간 추월 공략";
    return "균형형 주행/상황 대응";
  }

  function openPlayerCard(p){
    const modal=document.getElementById("playerModal");
    const title=document.getElementById("playerModalTitle");
    const body=document.getElementById("playerModalBody");
    const entries=Object.entries(p.stats).sort((a,b)=>b[1]-a[1]);
    title.textContent=`${p.name} · OVR ${overallOf(p)} · ${styleLabel(p.drivingStyle.style)}`;
    body.innerHTML=`
      <div class="profile-hero">
        ${avatarHtml(p.index,"profile-avatar")}
        <div><b>${p.name}</b><span>${isTeamMode()?teamLabel(p.team)+" · ":""}${styleLabel(p.drivingStyle.style)}</span><small>OVR ${overallOf(p)}</small></div>
      </div>
      <div class="profileSummary">
        <div><b>경기 구분</b><span>${isTeamMode()?teamLabel(p.team):"8인 개인전"}</span></div>
        <div><b>주행 성향</b><span>${styleLabel(p.drivingStyle.style)}</span></div>
        <div><b>AI 개성</b><span>${identitySummary(p)}</span></div>
        <div><b>시그니처</b><span>${personalitySummary759(p).signature}</span></div>
        <div><b>클러치</b><span>${Math.round(personalitySummary759(p).clutch*100)}</span></div>
        <div><b>현재 라이벌</b><span>${personalitySummary759(p).rival||"-"}</span></div>
        <div><b>현재 유닛</b><span>${unitChassis764().name} · ${unitChassis764().role}</span></div>
        <div><b>유닛 특성</b><span>속도 x${unitChassis764().topSpeed.toFixed(3)} · 충돌 ${unitChassis764().hitRadius.toFixed(2)}</span></div>
        <div><b>유닛 궁합</b><span>${unitCompatibility769(p).grade} · ${Math.round(unitCompatibility769(p).fit*100)}</span></div>
        <div><b>당일 컨디션</b><span>${p.raceForm>=1.025?"좋음":p.raceForm<=.975?"흔들림":"보통"}</span></div>
        <div><b>누적점수</b><span>${playerTournament[p.index]?.total||0}점</span></div>
        <div><b>강점</b><span>${entries.slice(0,3).map(([k,v])=>`${statLabel(k)} ${v}`).join(" · ")}</span></div>
        <div><b>약점</b><span>${entries.slice(-3).reverse().map(([k,v])=>`${statLabel(k)} ${v}`).join(" · ")}</span></div>
      </div>
      <div class="statGrid">${Object.entries(p.stats).map(([k,v])=>`<div class="statCell"><span>${statLabel(k)}</span><b>${v}</b></div>`).join("")}</div>
      ${seasonCardHtml(p)}
      ${analyticsProfileHtml749(p)}`;
    modal.classList.remove("hidden");
  }


  // v2.23: FM-style single-match rating.
  // Rating rewards actual race contribution, not raw attributes.
  function roundPerformanceRating(x){
    let score=6.00;

    // Finish position is important, but not the whole rating.
    score += (9-x.rank)*.19;

    // Race contribution.
    score += Math.min(1.05,(x.overtakes||0)*.11);
    score += Math.min(.70,(x.leadMs||0)/1000*.018);
    score += Math.min(.45,(x.avoids||0)*.025);
    score += Math.min(.42,Math.max(0,x.rankGain||0)*.09);

    // Execution quality.
    const controlRate=x.controlAttempts ? x.controlSuccesses/x.controlAttempts : 1;
    score += (controlRate-.75)*.90;
    score += Math.max(-.18,Math.min(.22,((x.efficiency||100)-100)*.035));

    // Mistakes are costly.
    score -= (x.collisions||0)*.42;

    // Small condition interpretation only; it does not directly hand out a big bonus.
    if(x.raceForm!=null) score += Math.max(-.10,Math.min(.10,(x.raceForm-1)*2.2));

    return Math.max(4.0,Math.min(10.0,score));
  }

  function aggregateMatchRatings(){
    const rows=players.map(p=>({
      index:p.index,name:p.name,team:p.team,
      ratingSum:0,rounds:0,best:0,worst:10,
      wins:0,top3:0,overtakes:0,collisions:0,rankGain:0
    }));
    for(const round of roundHistory){
      for(const x of round.players){
        const a=rows[x.index];
        const rt=roundPerformanceRating(x);
        x.rating=rt;
        a.ratingSum+=rt;a.rounds++;
        a.best=Math.max(a.best,rt);a.worst=Math.min(a.worst,rt);
        a.wins+=x.rank===1?1:0;a.top3+=x.rank<=3?1:0;
        a.overtakes+=x.overtakes||0;a.collisions+=x.collisions||0;
        a.rankGain=Math.max(a.rankGain,x.rankGain||0);
      }
    }
    rows.forEach(a=>{
      a.rating=a.rounds?a.ratingSum/a.rounds:0;
      if(!a.rounds){a.best=0;a.worst=0;}
    });
    return rows.sort((a,b)=>b.rating-a.rating || b.wins-a.wins || a.name.localeCompare(b.name));
  }

  function ratingGrade(r){
    if(r>=9.0) return "S";
    if(r>=8.3) return "A+";
    if(r>=7.7) return "A";
    if(r>=7.0) return "B+";
    if(r>=6.4) return "B";
    if(r>=5.7) return "C";
    return "D";
  }

  function buildMatchAwards(){
    const all=[];
    for(const r of roundHistory){
      for(const p of r.players) all.push({...p,round:r.round});
    }
    if(!all.length) return [];

    const agg=new Map();
    for(const x of all){
      let a=agg.get(x.index);
      if(!a){
        a={index:x.index,name:x.name,team:x.team,points:0,wins:0,overtakes:0,collisions:0,avoids:0,leadMs:0,bestSector:Infinity,rankSum:0,rounds:0};
        agg.set(x.index,a);
      }
      a.points+=x.points;
      a.wins+=x.rank===1?1:0;
      a.overtakes+=x.overtakes||0;
      a.collisions+=x.collisions||0;
      a.avoids+=x.avoids||0;
      a.leadMs+=x.leadMs||0;
      if(x.bestSector!=null) a.bestSector=Math.min(a.bestSector,x.bestSector);
      a.rankSum+=x.rank;
      a.rounds++;
    }
    const arr=[...agg.values()];
    const mvp=[...arr].sort((a,b)=>
      (b.points+b.wins*4+b.overtakes*.7+b.leadMs/12000-b.collisions*1.2)-
      (a.points+a.wins*4+a.overtakes*.7+a.leadMs/12000-a.collisions*1.2)
    )[0];
    const pass=[...arr].sort((a,b)=>b.overtakes-a.overtakes || a.rankSum/a.rounds-b.rankSum/b.rounds)[0];
    const clean=[...arr].sort((a,b)=>a.collisions-b.collisions || a.rankSum/a.rounds-b.rankSum/b.rounds)[0];
    const sector=[...arr].filter(a=>Number.isFinite(a.bestSector)).sort((a,b)=>a.bestSector-b.bestSector)[0];

    const result=[
      {label:"경기 MVP",name:mvp.name,value:`${mvp.points>0?"+":""}${mvp.points}점 · ${mvp.wins}승`},
      {label:"최다 추월",name:pass.name,value:`추월 ${pass.overtakes}회`},
      {label:"무충돌 베스트",name:clean.name,value:`충돌 ${clean.collisions}회 · 평균 ${(clean.rankSum/clean.rounds).toFixed(1)}위`}
    ];
    if(sector) result.push({label:"최고 구간기록",name:sector.name,value:formatTime(sector.bestSector)});
    return result;
  }


  function aggregateTelemetry(){
    const map=new Map();
    for(const r of roundHistory){
      for(const x of r.players){
        let a=map.get(x.index);
        if(!a){
          a={index:x.index,name:x.name,team:x.team,rounds:0,controls:0,controlOK:0,
            zigzag:0,backcon:0,stopcon:0,wide:0,
            zigzagOK:0,backconOK:0,stopconOK:0,wideOK:0,
            inside:0,extreme:0,distance:0,efficiency:0,rankGain:0,
            passInside:0,passOutside:0,passWait:0,traces:[],deathPoints:[],startReactionSum:0,
            rankSum:0,timeSum:0,finishes:0};
          map.set(x.index,a);
        }
        a.rounds++;
        a.controls+=x.controlAttempts||0;
        a.controlOK+=x.controlSuccesses||0;
        const cb=x.controlByType||{};
        for(const k of ["zigzag","backcon","stopcon","wide"]){
          a[k]+=(cb[k]?.attempts||0);
          a[k+"OK"]+=(cb[k]?.successes||0);
        }
        a.inside+=x.insideRate||0;
        a.extreme+=x.extremeInsideRate||0;
        a.distance+=x.distance||0;
        a.efficiency+=x.efficiency||0;
        a.startReactionSum+=x.startReactionMs||0;
        a.rankSum+=x.rank||0;
        if(Number.isFinite(x.time)){a.timeSum+=x.time;a.finishes++;}
        if(x.deathPoints?.length) a.deathPoints.push(...x.deathPoints.map(d=>({...d,round:r.round})));
        a.rankGain=Math.max(a.rankGain,x.rankGain||0);
        a.passInside+=(x.passPlans?.inside||0);
        a.passOutside+=(x.passPlans?.outside||0);
        a.passWait+=(x.passPlans?.waitCut||0);
        if(x.trace?.length) a.traces.push({round:r.round,points:x.trace});
      }
    }
    return [...map.values()].map(a=>({
      ...a,
      controlRate:a.controls?100*a.controlOK/a.controls:0,
      avgInside:a.rounds?a.inside/a.rounds:0,
      avgExtreme:a.rounds?a.extreme/a.rounds:0,
      avgEfficiency:a.rounds?a.efficiency/a.rounds:0,
      avgStartReaction:a.rounds?a.startReactionSum/a.rounds:0,
      avgRank:a.rounds?a.rankSum/a.rounds:0,
      avgTime:a.finishes?a.timeSum/a.finishes:0
    })).sort((a,b)=>(playerTournament[b.index]?.total||0)-(playerTournament[a.index]?.total||0));
  }

  function drawTelemetryTrace(playerIndex,roundNum){
    const canvas=document.getElementById("traceCanvas");
    const title=document.getElementById("traceTitle");
    if(!canvas) return;
    const ctx=canvas.getContext("2d");
    const agg=aggregateTelemetry().find(a=>a.index===playerIndex);
    if(!agg) return;
    const trace=agg.traces.find(t=>t.round===roundNum)||agg.traces[agg.traces.length-1];
    if(!trace) return;

    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(map.complete&&map.naturalWidth>0){
      ctx.globalAlpha=.72;
      ctx.drawImage(map,0,0,canvas.width,canvas.height);
      ctx.globalAlpha=1;
    }
    const sx=canvas.width/MAP_W, sy=canvas.height/MAP_H;
    ctx.lineWidth=2.4;
    ctx.beginPath();
    trace.points.forEach((pt,i)=>{
      const x=pt[0]*sx,y=pt[1]*sy;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    if(trace.points.length){
      const a=trace.points[0],b=trace.points[trace.points.length-1];
      ctx.beginPath();ctx.arc(a[0]*sx,a[1]*sy,4,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(b[0]*sx,b[1]*sy,4,0,Math.PI*2);ctx.fill();
    }
    if(title) title.textContent=`${agg.name} · ${trace.round}R 실제 주행 궤적`;
  }

  function renderTelemetryPanel(){
    const body=document.getElementById("telemetryBody");
    const picks=document.getElementById("tracePicks");
    if(!body||!picks) return;
    const rows=aggregateTelemetry();
    body.innerHTML=rows.map(a=>{
      const deaths=a.deathPoints.length
        ? a.deathPoints.slice(-4).map(d=>{const b=d.blackbox||{};const m=b.modeCounts||{};return `R${d.round} ${d.progressPct}% ${DEATH_CAUSE_KO[d.cause]||d.cause||"접촉"} [시야${b.maxSeen??'-'} 클릭${b.clickCount??'-'} R${m.race||0}/E${(m.evade||0)+(m.diag||0)+(m.wide||0)+(m.zigzag||0)+(m.spin||0)}]`;}).join(" · ")
        : "-";
      const pb=loadRecordBook().players[a.name];
      return `<tr>
        <td><div class="table-player">${avatarHtml(a.index,"table-avatar")}<button class="trace-player player-link" data-player="${a.index}">${a.name}</button></div></td>
        <td><b>${a.avgRank.toFixed(2)}위</b></td>
        <td>${a.avgTime?formatTime(a.avgTime):"-"}</td>
        <td>${pb==null?"-":formatTime(pb)}</td>
        <td>${a.deathPoints.length}회${deaths!=="-"?` · ${deaths}`:""}</td>
        <td>${a.zigzag}</td>
        <td>${a.backcon}</td>
        <td>${a.avgInside.toFixed(0)}%</td>
        <td>${(a.avgStartReaction/1000).toFixed(3)}s</td>
      </tr>`;
    }).join("");

    picks.innerHTML=rows.map(a=>`<button class="tracePick" data-player="${a.index}">${a.name}</button>`).join("");
    const choose=(idx)=>{
      const a=rows.find(x=>x.index===idx);
      if(!a||!a.traces.length) return;
      drawTelemetryTrace(idx,a.traces[a.traces.length-1].round);
    };
    body.querySelectorAll(".trace-player").forEach(el=>el.addEventListener("click",()=>choose(Number(el.dataset.player))));
    picks.querySelectorAll(".tracePick").forEach(el=>el.addEventListener("click",()=>choose(Number(el.dataset.player))));
    if(rows.length) choose(rows[0].index);
  }


  // v2.24: rule-based post-race analysis built only from actual match telemetry.
  function playerMatchAnalysis(index){
    const rounds=[];
    for(const r of roundHistory){
      const x=r.players.find(p=>p.index===index);
      if(x) rounds.push({...x,round:r.round});
    }
    if(!rounds.length) return null;

    const p=players[index];
    const avgRank=rounds.reduce((s,x)=>s+x.rank,0)/rounds.length;
    const avgRating=rounds.reduce((s,x)=>s+(x.rating||roundPerformanceRating(x)),0)/rounds.length;
    const wins=rounds.filter(x=>x.rank===1).length;
    const top3=rounds.filter(x=>x.rank<=3).length;
    const overtakes=rounds.reduce((s,x)=>s+(x.overtakes||0),0);
    const collisions=rounds.reduce((s,x)=>s+(x.collisions||0),0);
    const avoids=rounds.reduce((s,x)=>s+(x.avoids||0),0);
    const controls=rounds.reduce((s,x)=>s+(x.controlAttempts||0),0);
    const controlOK=rounds.reduce((s,x)=>s+(x.controlSuccesses||0),0);
    const controlRate=controls?controlOK/controls:1;
    const leadMs=rounds.reduce((s,x)=>s+(x.leadMs||0),0);
    const rankGain=Math.max(...rounds.map(x=>x.rankGain||0));
    const avgEff=rounds.reduce((s,x)=>s+(x.efficiency||100),0)/rounds.length;
    const inside=rounds.reduce((s,x)=>s+(x.insideRate||0),0)/rounds.length;
    const extreme=rounds.reduce((s,x)=>s+(x.extremeInsideRate||0),0)/rounds.length;
    const bestRound=[...rounds].sort((a,b)=>(b.rating||0)-(a.rating||0) || a.rank-b.rank)[0];
    const worstRound=[...rounds].sort((a,b)=>(a.rating||0)-(b.rating||0) || b.rank-a.rank)[0];

    const strengths=[], weaknesses=[];
    if(wins) strengths.push(`${wins}개 라운드 우승으로 결과를 만들었다`);
    else if(top3>=2) strengths.push(`${top3}개 라운드 상위 3위로 꾸준하게 상위권을 유지했다`);
    if(overtakes>=8) strengths.push(`총 ${overtakes}회 추월로 공격적인 레이스를 만들었다`);
    else if(overtakes>=4) strengths.push(`추월 ${overtakes}회로 순위 싸움에서 존재감을 보였다`);
    if(rankGain>=4) strengths.push(`한 라운드에서 최대 ${rankGain}계단을 끌어올리는 역전 능력을 보였다`);
    if(controlRate>=.90 && controls>=3) strengths.push(`컨트롤 성공률 ${(controlRate*100).toFixed(0)}%로 실행력이 안정적이었다`);
    if(collisions===0) strengths.push(`5라운드 동안 충돌 없이 완주했다`);
    if(leadMs>=8000) strengths.push(`선두를 ${(leadMs/1000).toFixed(1)}초 유지하며 경기 주도권을 잡았다`);
    if(inside>=48) strengths.push(`인코스 활용률 ${inside.toFixed(0)}%로 코너 공략이 적극적이었다`);
    if(extreme>=20) strengths.push(`극인코스 ${extreme.toFixed(0)}%로 과감한 최단라인 공략을 보여줬다`);
    if(avgEff>=100) strengths.push(`라인효율 ${avgEff.toFixed(1)}%로 이동거리 관리가 좋았다`);

    if(collisions>=3) weaknesses.push(`충돌 ${collisions}회가 순위와 기록 손실의 가장 큰 원인이었다`);
    else if(collisions>=1) weaknesses.push(`충돌 ${collisions}회로 불필요한 정지 손실이 발생했다`);
    if(controlRate<.72 && controls>=3) weaknesses.push(`컨트롤 성공률 ${(controlRate*100).toFixed(0)}%로 실행 실수가 많았다`);
    else if(controlRate<.84 && controls>=4) weaknesses.push(`컨트롤 성공률 ${(controlRate*100).toFixed(0)}%로 안정성이 다소 부족했다`);
    if(avgRank>=6) weaknesses.push(`평균 ${avgRank.toFixed(1)}위로 상위권 진입 빈도가 부족했다`);
    if(overtakes<=1 && avgRank>4.5) weaknesses.push(`추월이 ${overtakes}회에 그쳐 뒤처진 뒤 순위를 회복하기 어려웠다`);
    if(avgEff<98.7) weaknesses.push(`라인효율 ${avgEff.toFixed(1)}%로 우회·회피 과정에서 이동거리 손실이 컸다`);
    if(worstRound && bestRound && (bestRound.rating-worstRound.rating)>=1.1)
      weaknesses.push(`${bestRound.round}R과 ${worstRound.round}R의 경기력 편차가 크게 나타났다`);

    if(!strengths.length){
      if(avgRating>=7) strengths.push(`평점 ${avgRating.toFixed(1)}로 전체적으로 무난한 경기력을 유지했다`);
      else strengths.push(`큰 사고 없이 경기 데이터를 쌓았지만 뚜렷한 강점은 만들지 못했다`);
    }
    if(!weaknesses.length){
      weaknesses.push(`큰 약점은 없었으며 다음 경기에서는 추월과 선두 유지 시간을 더 늘릴 여지가 있다`);
    }

    let headline;
    if(avgRating>=8.6) headline="압도적인 경기력";
    else if(avgRating>=7.8) headline="상위권을 만든 좋은 경기";
    else if(avgRating>=7.0) headline="안정적인 경기";
    else if(avgRating>=6.2) headline="기복이 있었던 경기";
    else headline="개선이 필요한 경기";

    let summary=`${headline}. 평균 ${avgRank.toFixed(2)}위, 평점 ${avgRating.toFixed(1)}. `;
    if(wins) summary+=`${wins}승을 기록했고 `;
    if(overtakes) summary+=`총 ${overtakes}회 추월했다. `;
    summary+=collisions?`충돌은 ${collisions}회 발생했다.`:`무충돌로 마쳤다.`;

    return {
      index,name:p.name,team:p.team,avgRank,avgRating,wins,top3,overtakes,collisions,
      controls,controlRate,leadMs,rankGain,avgEff,inside,extreme,
      bestRound:bestRound?.round,worstRound:worstRound?.round,
      strengths:strengths.slice(0,3),weaknesses:weaknesses.slice(0,3),summary
    };
  }
  function buildMatchAnalysisReport(){
    const reports=players.map((_,i)=>playerMatchAnalysis(i)).filter(Boolean)
      .sort((a,b)=>b.avgRating-a.avgRating||a.avgRank-b.avgRank);
    const avg=(arr,key)=>arr.length?arr.reduce((s,x)=>s+x[key],0)/arr.length:0;
    const allLeaderChanges=roundHistory.reduce((s,r)=>s+(r.leaderChanges||0),0);
    const allOvertakes=roundHistory.reduce((s,r)=>s+(r.totalOvertakes||0),0);
    const teamSummary={};let matchText="";
    if(isTeamMode()){
      for(const team of ["RED","BLUE"]){
        const rows=reports.filter(x=>x.team===team);
        teamSummary[team]={rating:avg(rows,"avgRating"),collisions:rows.reduce((s,x)=>s+x.collisions,0),overtakes:rows.reduce((s,x)=>s+x.overtakes,0)};
      }
      const winner=teamWinner();
      matchText=winner?`${teamLabel(winner)} 승리 · 빨강 ${teamTotals.RED}점 : ${teamTotals.BLUE}점 파랑.`:`팀전 무승부 · 빨강 ${teamTotals.RED}점 : ${teamTotals.BLUE}점 파랑.`;
    }else{
      const ordered=Object.values(playerTournament).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));
      const leader=ordered[0];matchText=`8인 개인전 · ${leader?`${leader.name} ${leader.total}점으로 선두.`:"경기 진행 중."}`;
    }
    matchText+=` 선두교체 ${allLeaderChanges}회 · 순위상승 ${allOvertakes}회.`;
    return {reports,teamSummary,matchText};
  }


  function renderMatchAnalysis(){
    const wrap=document.getElementById("matchAnalysis");
    if(!wrap) return;
    const data=buildMatchAnalysisReport();
    wrap.innerHTML=`
      <div class="analysis-overview">
        <span>MATCH REVIEW</span>
        <b>${data.matchText}</b>
      </div>
      <div class="analysis-grid">
        ${data.reports.map((a,i)=>`
          <article class="analysis-card ${i===0?"best":""}">
            <div class="analysis-head">
              <div class="analysis-player">${avatarHtml(a.index,"analysis-avatar")}<div><span>${isTeamMode()?teamLabel(a.team):"개인전"}</span><b>${a.name}</b></div></div>
              <strong>${a.avgRating.toFixed(1)}</strong>
            </div>
            <p>${a.summary}</p>
            <div class="analysis-block good"><b>잘한 점</b>${a.strengths.map(x=>`<span>+ ${x}</span>`).join("")}</div>
            <div class="analysis-block bad"><b>아쉬운 점</b>${a.weaknesses.map(x=>`<span>− ${x}</span>`).join("")}</div>
            <small>평균 ${a.avgRank.toFixed(2)}위 · 상위 3위 ${a.top3}회 · 추월 ${a.overtakes} · 충돌 ${a.collisions} · 컨트롤 ${(a.controlRate*100).toFixed(0)}%</small>
          </article>`).join("")}
      </div>`;
  }


  function prepChart(canvas){
    if(!canvas) return null;
    const ctx=canvas.getContext("2d");
    const w=canvas.width,h=canvas.height;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="rgba(4,9,16,.86)";
    ctx.fillRect(0,0,w,h);
    return {ctx,w,h};
  }

  function drawRankChart(){
    const canvas=document.getElementById("rankChart");
    const legend=document.getElementById("rankLegend");
    const c=prepChart(canvas); if(!c) return;
    const {ctx,w,h}=c, L=56,R=24,T=28,B=42;
    ctx.strokeStyle="rgba(255,255,255,.12)";ctx.lineWidth=1;
    ctx.font="12px system-ui";ctx.fillStyle="rgba(255,255,255,.65)";
    ctx.textAlign="right";ctx.textBaseline="middle";
    for(let rank=1;rank<=12;rank++){
      const y=T+(rank-1)*(h-T-B)/11;
      ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(w-R,y);ctx.stroke();
      ctx.fillText(`${rank}위`,L-10,y);
    }
    ctx.textAlign="center";ctx.textBaseline="top";
    for(let r=1;r<=5;r++){
      const x=L+(r-1)*(w-L-R)/4;
      ctx.fillText(`${r}R`,x,h-B+13);
    }

    for(let idx=0;idx<players.length;idx++){
      const pts=[];
      for(let r=1;r<=5;r++){
        const rd=roundHistory.find(q=>q.round===r);
        const x=rd?.players.find(q=>q.index===idx);
        if(x) pts.push({r,rank:x.rank});
      }
      if(!pts.length) continue;
      ctx.strokeStyle=colors[idx];ctx.fillStyle=colors[idx];ctx.lineWidth=3;
      ctx.beginPath();
      pts.forEach((p,i)=>{
        const x=L+(p.r-1)*(w-L-R)/4;
        const y=T+(p.rank-1)*(h-T-B)/11;
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      });
      ctx.stroke();
      pts.forEach(p=>{
        const x=L+(p.r-1)*(w-L-R)/2,y=T+(p.rank-1)*(h-T-B)/11;
        ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();
      });
    }
    if(legend) legend.innerHTML=players.map(p=>`<span><i style="background:${colors[p.index]}"></i>${avatarHtml(p.index,"legend-avatar")}${p.name}</span>`).join("");
  }

  function drawPerformanceChart(){
    const canvas=document.getElementById("performanceChart");
    const c=prepChart(canvas); if(!c) return;
    const {ctx,w,h}=c;
    const rows=aggregateMatchRatings().slice().sort((a,b)=>b.rating-a.rating);
    const left=120,right=26,top=22,rowH=(h-top-18)/rows.length;
    ctx.font="12px system-ui";ctx.textBaseline="middle";
    rows.forEach((a,i)=>{
      const y=top+i*rowH+rowH/2;
      ctx.fillStyle="rgba(255,255,255,.12)";
      ctx.fillRect(left,y-8,w-left-right,16);
      const ratingWidth=(w-left-right)*Math.max(0,Math.min(1,(a.rating-4)/6));
      ctx.fillStyle=colors[a.index];
      ctx.fillRect(left,y-8,ratingWidth,16);
      ctx.fillStyle="#fff";ctx.textAlign="right";ctx.fillText(a.name,left-12,y);
      ctx.textAlign="left";ctx.fillText(`${a.rating.toFixed(1)}  ·  추월 ${a.overtakes}  ·  충돌 ${a.collisions}`,left+ratingWidth+8,y);
    });
  }

  function drawAllRoutes(roundNum=3){
    const canvas=document.getElementById("allRouteCanvas");
    const legend=document.getElementById("routeLegend");
    const c=prepChart(canvas); if(!c) return;
    const {ctx,w,h}=c;
    if(map.complete&&map.naturalWidth>0){
      ctx.globalAlpha=.66;ctx.drawImage(map,0,0,w,h);ctx.globalAlpha=1;
    }
    const rd=roundHistory.find(r=>r.round===roundNum);
    if(!rd) return;
    const sx=w/MAP_W, sy=h/MAP_H;
    for(const x of rd.players){
      if(!x.trace?.length) continue;
      ctx.strokeStyle=colors[x.index];ctx.lineWidth=2.5;ctx.globalAlpha=.92;
      ctx.beginPath();
      x.trace.forEach((pt,i)=>{
        const px=pt[0]*sx,py=pt[1]*sy;
        if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
      });
      ctx.stroke();ctx.globalAlpha=1;
      const end=x.trace[x.trace.length-1];
      ctx.fillStyle=colors[x.index];ctx.beginPath();ctx.arc(end[0]*sx,end[1]*sy,4.5,0,Math.PI*2);ctx.fill();
    }
    if(legend) legend.innerHTML=rd.players.map(x=>`<span><i style="background:${colors[x.index]}"></i>${avatarHtml(x.index,"legend-avatar")}${x.name}</span>`).join("");
    document.querySelectorAll("#routeRoundPicks button").forEach(b=>b.classList.toggle("active",Number(b.dataset.round)===roundNum));
  }

  function renderVisualDashboard(){
    const podium=document.getElementById("visualPodium");
    const picks=document.getElementById("routeRoundPicks");
    if(!podium||!picks) return;
    const ratings=aggregateMatchRatings();
    const scoreRows=Object.values(playerTournament).sort((a,b)=>b.total-a.total || (ratings.find(x=>x.name===b.name)?.rating||0)-(ratings.find(x=>x.name===a.name)?.rating||0));
    podium.innerHTML=scoreRows.slice(0,3).map((pt,i)=>{
      const idx=names.indexOf(pt.name);
      const rt=ratings.find(x=>x.index===idx);
      const medal=i===0?"1위":i===1?"2위":"3위";
      return `<article class="podium-card p${i+1}">
        <div class="podium-rank">${medal}</div>
        ${avatarHtml(idx,"podium-avatar")}
        <div class="podium-copy"><b>${pt.name}</b><span>${isTeamMode()?teamLabel(pt.team):"8인 개인전"}</span><strong>${pt.total>0?"+":""}${pt.total}점</strong><small>평점 ${rt?rt.rating.toFixed(1):"-"} · 추월 ${rt?.overtakes||0}</small></div>
      </article>`;
    }).join("");
    picks.innerHTML=[1,2,3,4,5].map(r=>`<button data-round="${r}">${r}R 경로</button>`).join("");
    picks.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>drawAllRoutes(Number(b.dataset.round))));
    drawRankChart();
    drawPerformanceChart();
    drawAllRoutes(roundHistory.length?roundHistory[roundHistory.length-1].round:5);
  }


  function showMatchResults(){
    const panel=document.getElementById("resultPanel");
    const body=document.getElementById("resultBody");
    const teamSummary=document.getElementById("teamResultSummary");

    const teamMode=isTeamMode();
    const winnerTeam=teamMode?teamWinner():null;
    const winner=teamMode?(winnerTeam?`${teamLabel(winnerTeam)} 승리`:"무승부"):"개인전";
    const awards=buildMatchAwards();
    const ratings=aggregateMatchRatings();
    const ratingEl=document.getElementById("matchRatings");
    const awardsEl=document.getElementById("matchAwards");
    const timelineEl=document.getElementById("highlightTimeline");
    const autoEl=document.getElementById("autoHighlightClips");
    if(awardsEl){
      awardsEl.innerHTML=awards.map(a=>{
        const idx=names.indexOf(a.name);
        return `<div class="award-card">${avatarHtml(idx,"award-avatar")}<span>${a.label}</span><b>${a.name}</b><small>${a.value}</small></div>`;
      }).join("");
    }
    if(ratingEl){
      const mvp=ratings[0];
      ratingEl.innerHTML=`<div class="rating-mvp">
          ${mvp?avatarHtml(mvp.index,"mvp-avatar"):""}
          <span>경기 MVP</span>
          <b>${mvp?mvp.name:"-"}</b>
          <strong>${mvp?mvp.rating.toFixed(1):"-"}</strong>
          <small>${mvp?ratingGrade(mvp.rating):""}</small>
        </div>
        <div class="rating-grid">${ratings.map((a,i)=>`
          <div class="rating-card ${i===0?"mvp":""}">
            <div class="rating-player">${avatarHtml(a.index,"rating-avatar")}<span>${i+1}. ${a.name}</span></div>
            <b>${a.rating.toFixed(1)}</b>
            <small>${ratingGrade(a.rating)} · 최고평점 ${a.best.toFixed(1)} · 추월 ${a.overtakes} · 충돌 ${a.collisions}</small>
          </div>`).join("")}
        </div>`;
    }
    if(timelineEl){
      timelineEl.innerHTML=tournamentHighlights.length
        ? tournamentHighlights.map(h=>`<div class="highlight-row"><span>R${h.round}</span><b>${h.text}</b></div>`).join("")
        : `<div class="highlight-empty">기록된 하이라이트가 없습니다.</div>`;
    }
    if(autoEl){
      const clips=[];
      for(const [r,marks] of Object.entries(highlightArchive)){
        for(const h of marks) clips.push({round:Number(r),...h});
      }
      clips.sort((a,b)=>b.importance-a.importance || a.round-b.round || a.t-b.t);
      autoEl.innerHTML=clips.slice(0,14).map(h=>`<button class="auto-clip" data-round="${h.round}" data-time="${h.t}" data-player="${h.playerId??-1}" data-photo="${h.type==="PHOTO_FINISH"?1:0}">
        <span>${highlightTypeLabel(h.type)}</span><b>R${h.round} · ${h.text}</b>
      </button>`).join("") || `<div class="highlight-empty">자동 하이라이트가 없습니다.</div>`;
      autoEl.querySelectorAll(".auto-clip").forEach(b=>b.addEventListener("click",()=>{
        replayFocusId=Number(b.dataset.player);
        openReplay(Number(b.dataset.round),Math.max(0,Number(b.dataset.time)-1400),b.dataset.photo==="1");
      }));
    }
    const resultTitle=document.getElementById("resultTitle");
    const resultTeamHead=document.getElementById("resultTeamHead");
    if(resultTitle)resultTitle.textContent=teamMode?"팀전 4 vs 4 · 경기 통계":"8인 개인전 · 경기 통계";
    if(resultTeamHead)resultTeamHead.style.display=teamMode?"":"none";
    if(teamSummary){
      if(teamMode){
        const red=teamTotals.RED||0,blue=teamTotals.BLUE||0;
        teamSummary.innerHTML=`<div class="v813-team-result">
          <div class="v813-team-result-card v813-red"><span>빨강팀</span><strong>${red}</strong><small>4명</small></div>
          <div class="v813-team-result-center">${red===blue?"DRAW":"VS"}</div>
          <div class="v813-team-result-card v813-blue"><span>파랑팀</span><strong>${blue}</strong><small>4명</small></div>
        </div>`;
      }else{
        const personalRows=Object.values(playerTournament).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));
        const leader=personalRows[0];
        teamSummary.innerHTML=`<div class="v813-mode-summary"><div><b>8인 개인전</b><span>팀 구분 없이 선수 8명의 순위·기록·평점을 집계</span></div>
          <strong>${leader?`${leader.name} · ${leader.total}점`:"-"}</strong></div>`;
      }
    }

    const rows=Object.values(playerTournament).sort((a,b)=>b.total-a.total || a.name.localeCompare(b.name));
    body.innerHTML=rows.map((pt,i)=>{
      const r=[1,2,3,4,5].map(n=>{
        const x=pt.rounds.find(v=>v.round===n);
        return x ? `${x.rank}위 / ${x.points>0?"+":""}${x.points}` : "-";
      });
      return `<tr>
        <td>${i+1}</td>
        ${teamMode?`<td class="result-team-cell"><span class="team-mini team-${pt.team==="RED"?"a":"b"}">${pt.team==="RED"?"R":"B"}</span></td>`:""}
        <td><div class="table-player">${avatarHtml(names.indexOf(pt.name),"table-avatar")}<button class="result-name player-link" data-player="${names.indexOf(pt.name)}">${pt.name}</button></div></td>
        <td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td>
        <td><b>${pt.total>0?"+":""}${pt.total}</b></td>
      </tr>`;
    }).join("");
    body.querySelectorAll(".result-name").forEach(el=>{
      el.addEventListener("click",()=>openPlayerCard(players[Number(el.dataset.player)]));
    });
    renderTelemetryPanel();
    renderMatchAnalysis();
    renderVisualDashboard();
    panel.classList.remove("hidden");
  }



  // v2.28: REAL live-race balance archive.
  // Unlike the fast Monte-Carlo test below, this stores completed rounds from
  // the actual canvas race engine. Keep only recent rounds so localStorage stays small.
  const LIVE_BALANCE_KEY="observerFM_v228_live_balance";
  const LIVE_BALANCE_MAX=500;

  function loadLiveBalance(){
    try{
      const rows=JSON.parse(localStorage.getItem(LIVE_BALANCE_KEY)||"[]");
      return Array.isArray(rows)?rows:[];
    }catch(e){ return []; }
  }

  function saveLiveBalance(rows){
    try{localStorage.setItem(LIVE_BALANCE_KEY,JSON.stringify(rows.slice(-LIVE_BALANCE_MAX)));}catch(e){}
  }

  function recordLiveBalanceRound(result){
    if(!result || !result.players?.length) return;
    const rows=loadLiveBalance();
    const top1=result.players[0], top2=result.players[1];
    rows.push({
      t:Date.now(),
      round:result.round,
      leaderChanges:result.leaderChanges||0,
      totalOvertakes:result.totalOvertakes||result.players.reduce((s,x)=>s+(x.overtakes||0),0),
      photoFinish:!!(top1&&top2&&Math.abs(top2.time-top1.time)<=500),
      winnerTime:top1?.time||0,
      lastTime:result.players[result.players.length-1]?.time||0,
      players:result.players.map(x=>({
        index:x.index,name:x.name,rank:x.rank,time:x.time,
        collisions:x.collisions||0,overtakes:x.overtakes||0,avoids:x.avoids||0,
        controls:x.controlAttempts||0,controlOK:x.controlSuccesses||0,
        rating:x.rating||roundPerformanceRating(x),raceForm:x.raceForm??1,
        efficiency:x.efficiency||0
      }))
    });
    saveLiveBalance(rows);
  }

  function liveBalanceReport(){
    const rounds=loadLiveBalance();
    if(!rounds.length) return {rounds:[],players:[],warnings:[]};

    const agg=players.map(p=>({index:p.index,name:p.name,starts:0,wins:0,top3:0,
      rankSum:0,timeSum:0,collisions:0,overtakes:0,controls:0,controlOK:0,
      ratingSum:0,upsets:0}));

    let winnerTime=0,lastTime=0,collisions=0,overtakes=0,leaderChanges=0,photo=0;
    let upsetRounds=0;

    for(const r of rounds){
      winnerTime+=r.winnerTime||0; lastTime+=r.lastTime||0;
      leaderChanges+=r.leaderChanges||0; photo+=r.photoFinish?1:0;
      let roundUpset=false;

      for(const x of r.players||[]){
        const a=agg[x.index];
        if(!a) continue;
        a.starts++; a.wins+=x.rank===1?1:0; a.top3+=x.rank<=3?1:0;
        a.rankSum+=x.rank; a.timeSum+=x.time||0;
        a.collisions+=x.collisions||0; a.overtakes+=x.overtakes||0;
        a.controls+=x.controls||0; a.controlOK+=x.controlOK||0;
        a.ratingSum+=x.rating||0;
        collisions+=x.collisions||0; overtakes+=x.overtakes||0;
      }

      // Upset = winner was outside top-3 by fixed OVR/ability ordering.
      const winner=(r.players||[]).find(x=>x.rank===1);
      if(winner){
        const abilityOrder=players.map(p=>({
          i:p.index,
          o:(p.stats.pace+p.stats.cornering+p.stats.insideLine+p.stats.routeReading+
             p.stats.avoidance+p.stats.control+p.stats.consistency+p.stats.focus)/8
        })).sort((a,b)=>b.o-a.o);
        const seed=abilityOrder.findIndex(q=>q.i===winner.index)+1;
        if(seed>=4){roundUpset=true;agg[winner.index].upsets++;}
      }
      if(roundUpset) upsetRounds++;
    }

    const n=rounds.length;
    const valid=agg.filter(a=>a.starts).map(a=>({
      ...a,
      winRate:100*a.wins/a.starts,
      top3Rate:100*a.top3/a.starts,
      avgRank:a.rankSum/a.starts,
      avgTime:a.timeSum/a.starts/1000,
      collisionRate:a.collisions/a.starts,
      overtakeRate:a.overtakes/a.starts,
      controlRate:a.controls?100*a.controlOK/a.controls:100,
      avgRating:a.ratingSum/a.starts
    })).sort((a,b)=>b.winRate-a.winRate || a.avgRank-b.avgRank);

    const maxWin=valid.length?Math.max(...valid.map(a=>a.winRate)):0;
    const minWin=valid.length?Math.min(...valid.map(a=>a.winRate)):0;
    const avgWinner=winnerTime/n/1000;
    const avgLast=lastTime/n/1000;
    const avgCollisions=collisions/n;
    const avgOvertakes=overtakes/n;
    const warnings=[];

    if(n<30) warnings.push(`표본 부족 · 실전 ${n}라운드 (30라운드 이상 권장)`);
    if(n>=30 && maxWin>28) warnings.push(`우승 편중 가능성 · 최고 우승률 ${maxWin.toFixed(1)}%`);
    if(n>=30 && maxWin-minWin>20) warnings.push(`선수간 우승률 편차 큼 · ${(maxWin-minWin).toFixed(1)}%p`);
    if(avgWinner<45) warnings.push(`선두 평균 기록이 목표보다 빠를 수 있음 · ${avgWinner.toFixed(1)}초`);
    if(avgWinner>65) warnings.push(`선두 평균 기록이 목표보다 느릴 수 있음 · ${avgWinner.toFixed(1)}초`);
    if(avgCollisions<.35) warnings.push(`충돌이 매우 적음 · 경기당 ${avgCollisions.toFixed(2)}회`);
    if(avgCollisions>3.0) warnings.push(`충돌이 많음 · 경기당 ${avgCollisions.toFixed(2)}회`);
    if(avgOvertakes<5) warnings.push(`추월이 적음 · 경기당 ${avgOvertakes.toFixed(1)}회`);
    const upsetRate=100*upsetRounds/n;
    if(n>=30 && upsetRate<5) warnings.push(`이변 빈도가 낮음 · ${upsetRate.toFixed(1)}%`);
    if(n>=30 && upsetRate>40) warnings.push(`이변 빈도가 높음 · ${upsetRate.toFixed(1)}%`);

    return {
      rounds,players:valid,warnings,
      avgWinner,avgLast,avgSpread:avgLast-avgWinner,
      avgCollisions,avgOvertakes,avgLeaderChanges:leaderChanges/n,
      photoRate:100*photo/n,upsetRate
    };
  }

  function renderLiveBalance(){
    const summary=document.getElementById("liveBalanceSummary");
    const body=document.getElementById("liveBalanceBody");
    const warnings=document.getElementById("liveBalanceWarnings");
    if(!summary||!body||!warnings) return;
    const r=liveBalanceReport();

    if(!r.rounds.length){
      summary.innerHTML=`<div class="balance-empty">아직 저장된 실전 라운드가 없습니다. 실제 레이스를 완료하면 자동 누적됩니다.</div>`;
      body.innerHTML="";
      warnings.innerHTML="";
      return;
    }

    summary.innerHTML=`
      <div><span>실전 표본</span><b>${r.rounds.length}R</b></div>
      <div><span>평균 우승기록</span><b>${r.avgWinner.toFixed(2)}s</b></div>
      <div><span>평균 최하위</span><b>${r.avgLast.toFixed(2)}s</b></div>
      <div><span>P1-P8</span><b>${r.avgSpread.toFixed(2)}s</b></div>
      <div><span>경기당 충돌</span><b>${r.avgCollisions.toFixed(2)}</b></div>
      <div><span>경기당 추월</span><b>${r.avgOvertakes.toFixed(1)}</b></div>
      <div><span>선두교체</span><b>${r.avgLeaderChanges.toFixed(1)}</b></div>
      <div><span>포토피니시</span><b>${r.photoRate.toFixed(1)}%</b></div>
      <div><span>이변 발생률</span><b>${r.upsetRate.toFixed(1)}%</b></div>`;

    body.innerHTML=r.players.map(a=>`<tr>
      <td>${a.name}</td><td>${a.winRate.toFixed(1)}%</td><td>${a.top3Rate.toFixed(1)}%</td>
      <td>${a.avgRank.toFixed(2)}</td><td>${a.avgTime.toFixed(2)}s</td>
      <td>${a.avgRating.toFixed(2)}</td><td>${a.collisionRate.toFixed(2)}</td>
      <td>${a.overtakeRate.toFixed(1)}</td><td>${a.controlRate.toFixed(1)}%</td>
      <td>${a.upsets}</td></tr>`).join("");

    warnings.innerHTML=r.warnings.length
      ? r.warnings.map(x=>`<div class="balance-warning">⚠ ${x}</div>`).join("")
      : `<div class="balance-ok">실전 데이터 기준 큰 자동 경고 없음</div>`;
  }

  function resetLiveBalance(){
    if(!confirm("실전 밸런스 누적 데이터를 초기화할까요?")) return;
    localStorage.removeItem(LIVE_BALANCE_KEY);
    renderLiveBalance();
  }

  // v2.16: fast Monte-Carlo balance test.
  // This intentionally avoids canvas/DOM race rendering and approximates the live
  // race from the same fixed player stats/styles. It is a balance diagnostic, not
  // a replacement for the normal race simulation.
  function balancePlayerModel(p){
    const s=driverSkill739(p);
    return {
      overall:s.overall,
      pace:s.speed,
      safety:s.survival*.62+s.awareness*.20+s.mental*.10+s.judgment*.08,
      pass:s.aggression*.20+s.pressure*.15+s.insideLine*.15+s.routeReading*.18+
        s.prediction*.14+s.control*.18,
      control:s.hand*.62+s.mental*.23+s.braking*.15,
      start:s.startSkill,
      rejoin:s.rejoin,
      consistency:s.consistency
    };
  }

  function simulateBalanceRace(){
    const models=players.map(balancePlayerModel);
    const racers=players.map((p,i)=>{
      const m=models[i];
      const variance=(Math.random()-.5)*(1-m.consistency)*2.6;
      const startGain=(m.start-.60)*1.20;
      const base=56.2-(m.pace-.60)*10.8-startGain+variance;
      const controls=Math.max(2,Math.round(5.8+(1-m.safety)*3.8+Math.random()*2.4));
      let controlOK=0;
      for(let k=0;k<controls;k++){
        const chance=Math.max(.40,Math.min(.985,.35+m.control*.67));
        if(Math.random()<chance)controlOK++;
      }
      const hazard=Math.max(.035,.34-m.safety*.29);
      let collisions=0;
      for(let k=0;k<3;k++)if(Math.random()<hazard*(1-k*.18))collisions++;
      const survived=Math.random()<Math.max(.08,Math.min(.94,.12+m.safety*.88-collisions*.18));
      const avoids=Math.round(3+m.safety*7+Math.random()*3);
      const passPotential=Math.max(0,Math.round(.5+m.pass*4.2+Math.random()*2.4));
      const controlLoss=(controls-controlOK)*.30;
      const collisionLoss=collisions*(1.9+Math.random()*.75);
      const time=Math.max(41.5,base+controlLoss+collisionLoss+(Math.random()-.5)*.9);
      return {i,p,m,time,collisions,avoids,controls,controlOK,passPotential,rating:0,survived};
    });

    racers.sort((a,b)=>{
      if(a.survived!==b.survived)return a.survived?-1:1;
      return a.time-b.time;
    });
    let overtakes=0;
    racers.forEach((r,rank)=>{
      r.rank=rank+1;
      const startRank=r.i+1;
      const gain=Math.max(0,startRank-r.rank);
      r.overtakes=Math.max(gain,Math.min(7,r.passPotential+Math.floor(Math.random()*2)));
      const cr=r.controls?r.controlOK/r.controls:1;
      r.rating=Math.max(4,Math.min(10,
        5.7+(9-r.rank)*.20+Math.min(1.0,r.overtakes*.10)+(cr-.70)*1.0-r.collisions*.44+
        (r.survived?.30:-.18)));
      overtakes+=r.overtakes;
    });
    const leaderChanges=Math.max(0,Math.min(10,Math.round(overtakes/4+(Math.random()*2.2-.7))));
    return {racers,overtakes,leaderChanges,p1:racers[0].time,p8:racers[7].time};
  }

  function runBalanceTest(count){
    const started=performance.now();
    const agg=players.map(p=>({name:p.name,races:0,wins:0,top3:0,rankSum:0,timeSum:0,
      best:Infinity,worst:0,collisions:0,avoids:0,overtakes:0,controls:0,controlOK:0,ratingSum:0,upsets:0,survived:0,
      statLevel:Math.round(Object.values(p.stats).reduce((a,b)=>a+b,0)/Object.keys(p.stats).length)}));
    let totalP1=0,totalP8=0,totalSpread=0,totalCollisions=0,totalOvertakes=0,totalLeaderChanges=0,clean=0,upsetCount=0;

    for(let n=0;n<count;n++){
      const r=simulateBalanceRace();
      totalP1+=r.p1; totalP8+=r.p8; totalSpread+=r.p8-r.p1;
      totalOvertakes+=r.overtakes; totalLeaderChanges+=r.leaderChanges;
      let raceCollisions=0;
      for(const x of r.racers){
        const a=agg[x.i];
        a.races++; a.wins+=x.rank===1?1:0; a.top3+=x.rank<=3?1:0;
        a.rankSum+=x.rank; a.timeSum+=x.time; a.best=Math.min(a.best,x.time); a.worst=Math.max(a.worst,x.time);
        a.collisions+=x.collisions; a.avoids+=x.avoids; a.overtakes+=x.overtakes;
        a.controls+=x.controls; a.controlOK+=x.controlOK; a.ratingSum+=x.rating;
        a.survived+=x.survived?1:0;
        raceCollisions+=x.collisions;
      }
      const abilityOrder=players.map((p,i)=>({i,o:driverSkill739(p).overall}))
        .sort((a,b)=>b.o-a.o);
      const winner=r.racers[0];
      const seed=abilityOrder.findIndex(q=>q.i===winner.i)+1;
      if(seed>=4){ upsetCount++; agg[winner.i].upsets++; }
      totalCollisions+=raceCollisions;
      if(raceCollisions===0) clean++;
    }
    const elapsed=performance.now()-started;
    const winRates=agg.map(a=>100*a.wins/count);
    const maxWin=Math.max(...winRates),minWin=Math.min(...winRates);
    const avgP1=totalP1/count,avgP8=totalP8/count,avgSpread=totalSpread/count;
    const warnings=[];
    if(maxWin>24) warnings.push(`특정 선수 우승률 과다 · 최고 ${maxWin.toFixed(1)}%`);
    if(maxWin-minWin>16) warnings.push(`선수 우승률 편차 큼 · ${ (maxWin-minWin).toFixed(1)}%p`);
    if(avgP1<45) warnings.push(`선두 평균 기록이 빠른 편 · ${avgP1.toFixed(1)}초`);
    if(avgP1>65) warnings.push(`선두 평균 기록이 느린 편 · ${avgP1.toFixed(1)}초`);
    if(totalCollisions/count<.5) warnings.push(`충돌 빈도가 낮음 · 경기당 ${(totalCollisions/count).toFixed(2)}회`);
    if(totalCollisions/count>3.5) warnings.push(`충돌 빈도가 높음 · 경기당 ${(totalCollisions/count).toFixed(2)}회`);
    if(totalOvertakes/count<6) warnings.push(`추월 빈도가 낮음 · 경기당 ${(totalOvertakes/count).toFixed(1)}회`);
    if(100*upsetCount/count<5) warnings.push(`이변 빈도가 낮음 · ${(100*upsetCount/count).toFixed(1)}%`);
    if(100*upsetCount/count>40) warnings.push(`이변 빈도가 높음 · ${(100*upsetCount/count).toFixed(1)}%`);

    const groups={};
    for(const a of agg){
      const k=String(a.statLevel);
      if(!groups[k])groups[k]={stat:a.statLevel,players:0,races:0,wins:0,top3:0,survived:0,rankSum:0};
      const g=groups[k];g.players++;g.races+=a.races;g.wins+=a.wins;g.top3+=a.top3;g.survived+=a.survived;g.rankSum+=a.rankSum;
    }
    const statGroups=Object.values(groups).sort((a,b)=>b.stat-a.stat).map(g=>({
      stat:g.stat,players:g.players,winRate:100*g.wins/g.races,top3Rate:100*g.top3/g.races,
      survivalRate:100*g.survived/g.races,avgRank:g.rankSum/g.races
    }));

    return {count,elapsed,agg,statGroups,avgP1,avgP8,avgSpread,
      avgCollisions:totalCollisions/count,cleanRate:100*clean/count,
      avgOvertakes:totalOvertakes/count,avgLeaderChanges:totalLeaderChanges/count,
      upsetRate:100*upsetCount/count,warnings};
  }

  function runStatLab739(count=1000){
    return runBalanceTest(Math.max(20,Math.min(20000,Math.floor(count)||1000)));
  }

  function renderBalanceResult(result){
    const summary=document.getElementById("balanceSummary");
    const body=document.getElementById("balanceBody");
    const warnings=document.getElementById("balanceWarnings");
    if(!summary||!body||!warnings) return;

    summary.innerHTML=`
      <div><span>테스트 경기</span><b>${result.count.toLocaleString()}회</b></div>
      <div><span>계산 시간</span><b>${result.elapsed.toFixed(0)}ms</b></div>
      <div><span>평균 P1</span><b>${result.avgP1.toFixed(2)}s</b></div>
      <div><span>평균 P8</span><b>${result.avgP8.toFixed(2)}s</b></div>
      <div><span>P1-P8 격차</span><b>${result.avgSpread.toFixed(2)}s</b></div>
      <div><span>경기당 충돌</span><b>${result.avgCollisions.toFixed(2)}</b></div>
      <div><span>무충돌 경기</span><b>${result.cleanRate.toFixed(1)}%</b></div>
      <div><span>경기당 추월</span><b>${result.avgOvertakes.toFixed(1)}</b></div>
      <div><span>선두교체</span><b>${result.avgLeaderChanges.toFixed(1)}</b></div>
      <div><span>이변 발생률</span><b>${result.upsetRate.toFixed(1)}%</b></div>
      ${result.statGroups.map(g=>`<div><span>스탯 ${g.stat} · ${g.players}명</span><b>생존 ${g.survivalRate.toFixed(1)}% · 평균 ${g.avgRank.toFixed(2)}위</b></div>`).join("")}`;

    body.innerHTML=result.agg.map(a=>{
      const wr=100*a.wins/result.count,top3=100*a.top3/result.count;
      const cr=a.controls?100*a.controlOK/a.controls:0;
      const survival=100*a.survived/a.races;
      return `<tr><td>${a.name}</td><td>${a.statLevel}</td><td>${wr.toFixed(1)}%</td><td>${top3.toFixed(1)}%</td>
        <td>${survival.toFixed(1)}%</td><td>${(a.rankSum/a.races).toFixed(2)}</td><td>${(a.timeSum/a.races).toFixed(2)}s</td>
        <td>${a.best.toFixed(2)}s</td><td>${a.collisions}</td><td>${(a.overtakes/a.races).toFixed(1)}</td>
        <td>${cr.toFixed(1)}%</td><td>${(a.ratingSum/a.races).toFixed(2)}</td><td>${a.upsets}</td></tr>`;
    }).join("");

    warnings.innerHTML=result.warnings.length
      ? result.warnings.map(x=>`<div class="balance-warning">⚠ ${x}</div>`).join("")
      : `<div class="balance-ok">큰 자동 경고 없음 · 실제 경기 데이터와 함께 확인 권장</div>`;
  }

  function openBalanceTest(){
    const panel=document.getElementById("balancePanel");
    renderLiveBalance();
    if(panel) panel.classList.remove("hidden");
  }

  function formatTime(ms){
    if(ms==null || !isFinite(ms)) return "--";
    return `${(ms/1000).toFixed(3)}s`;
  }

  if(diagToggle && diagnostics){
    diagToggle.addEventListener("click",()=>{diagnostics.classList.toggle("hidden");renderDiagnostics();});
  }
  if(focusModeBtn){
    focusModeBtn.addEventListener("click",async()=>{
      const entering=!document.body.classList.contains("game-focus-mode");
      document.body.classList.toggle("game-focus-mode",entering);
      focusModeBtn.textContent=entering?"통계 화면으로":"게임 전체화면";
      if(entering && broadcastEl?.requestFullscreen){
        try{ await broadcastEl.requestFullscreen(); }catch(e){}
      }else if(!entering && document.fullscreenElement){
        try{ await document.exitFullscreen(); }catch(e){}
      }
    });
    document.addEventListener("fullscreenchange",()=>{
      if(!document.fullscreenElement && document.body.classList.contains("game-focus-mode")){
        document.body.classList.remove("game-focus-mode");
        focusModeBtn.textContent="게임 전체화면";
      }
    });
  }
  if(pauseBtn) pauseBtn.addEventListener("click",togglePause);
  const leagueProceed100=document.getElementById("leagueProceed100");
  if(leagueProceed100)leagueProceed100.addEventListener("click",beginLeagueSet100);
  const gauntletBtn190=document.getElementById("gauntletBtn190");
  if(gauntletBtn190)gauntletBtn190.addEventListener("click",()=>setGauntletMode190(!gauntletMode190));
  const gauntletAnalyticsBtn191=document.getElementById("gauntletAnalyticsBtn191");
  if(gauntletAnalyticsBtn191)gauntletAnalyticsBtn191.addEventListener("click",openGauntletAnalytics191);
  const gauntletCloseAnalytics191=document.getElementById("gauntletCloseAnalytics191");
  if(gauntletCloseAnalytics191)gauntletCloseAnalytics191.addEventListener("click",closeGauntletAnalytics191);
  const gauntletResetStats191=document.getElementById("gauntletResetStats191");
  if(gauntletResetStats191)gauntletResetStats191.addEventListener("click",resetGauntletAnalytics191);
  const gauntletAnalyticsModal191=document.getElementById("gauntletAnalytics191");
  if(gauntletAnalyticsModal191)gauntletAnalyticsModal191.addEventListener("click",e=>{if(e.target===gauntletAnalyticsModal191)closeGauntletAnalytics191();});
  startBtn.addEventListener("click",()=>{if(league100?.phase==="bracket")beginLeagueSet100();else start();});
  restartBtn.addEventListener("click",()=>{ reset(); start(); });
  document.getElementById("replayBtn").addEventListener("click",openReplay);
  document.getElementById("replayClose").addEventListener("click",()=>{
    replayPlaying=false;
    cancelAnimationFrame(replayRaf);
    document.getElementById("replayPanel").classList.add("hidden");
  });
  document.getElementById("replayPlay").addEventListener("click",e=>{
    replayPlaying=!replayPlaying;
    e.currentTarget.textContent=replayPlaying?"⏸ 정지":"▶ 재생";
    replayLastTs=0;
    if(replayPlaying) replayRaf=requestAnimationFrame(replayLoop);
  });
  document.getElementById("replaySlider").addEventListener("input",e=>{
    replayPlaying=false;
    document.getElementById("replayPlay").textContent="▶ 재생";
    setReplayCursor(Number(e.target.value));
  });
  document.querySelectorAll("[data-replay-speed]").forEach(b=>b.addEventListener("click",()=>{
    replaySpeed=1;
  }));
  document.getElementById("resultBtn").addEventListener("click",showMatchResults);
  document.getElementById("eloBtn").addEventListener("click",()=>{renderEloRanking();document.getElementById("eloPanel").classList.remove("hidden")});
  document.getElementById("eloClose").addEventListener("click",()=>document.getElementById("eloPanel").classList.add("hidden"));
  document.getElementById("balanceBtn").addEventListener("click",openBalanceTest);
  document.querySelectorAll("[data-balance-count]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const count=Number(btn.dataset.balanceCount)||100;
      btn.disabled=true;
      btn.textContent=`${count.toLocaleString()}회 계산 중…`;
      setTimeout(()=>{
        const result=runBalanceTest(count);
        renderBalanceResult(result);
        btn.disabled=false;
        btn.textContent=`${count.toLocaleString()}경기`;
      },30);
    });
  });
  document.getElementById("balanceClose").addEventListener("click",()=>document.getElementById("balancePanel").classList.add("hidden"));
  document.getElementById("liveBalanceReset").addEventListener("click",resetLiveBalance);
  document.getElementById("seasonResetBtn").addEventListener("click",resetSeason);
  document.getElementById("resultClose").addEventListener("click",()=>document.getElementById("resultPanel").classList.add("hidden"));
  document.getElementById("playerModalClose").addEventListener("click",()=>document.getElementById("playerModal").classList.add("hidden"));
  document.getElementById("playerModal").addEventListener("click",e=>{
    if(e.target.id==="playerModal") e.currentTarget.classList.add("hidden");
  });


  // ============================================================
  // 1) Sky Cliff: move the green finish gate slightly right/down so it sits on the visible road end.
  // 3) Space: remove the extra embedded gate rectangle artwork so only the live overlay gate remains.
  // ============================================================
  function applyPatch794(){
    const cliff=MAP_DEFINITIONS_770.cliff_hanger;
    if(cliff){
      if(Array.isArray(cliff.route770) && cliff.route770.length>=2){
        cliff.route770[cliff.route770.length-2]=[60.9,140.2];
        cliff.route770[cliff.route770.length-1]=[66.2,142.0];
      }
      cliff.goal={x:66.2,y:142.0};
      cliff.safeZones=Object.assign({},cliff.safeZones,{
        goal:{x0:61.8,y0:137.6,x1:70.6,y1:146.4}
      });
      cliff.strictRoadFollow778=true;
      cliff.roadFollowMode778='route-center-hard';
      const line=densifyLine772(cliff.route770,.22);
      cliff.racingSpline770=line;
      cliff.globalOptimal770=line;
      cliff.racingLineMode772='goal-endpoint-aligned-v7.94';
    }


    const space=MAP_DEFINITIONS_770.skyway;
    if(space){
      space.image='map_space_894.png?v=803-theme-tile';
      space.spaceExtraGateArtRemoved794=true;
    }
  }
  applyPatch794();

  // ============================================================
  // No global AI/map changes. This release freezes and audits the v7.94
  // geometry requirements for these two maps so later patches cannot silently
  // ============================================================
  function applyPatch7941(){
    const cliff=MAP_DEFINITIONS_770.cliff_hanger;
    if(cliff){
      // Keep the finish exactly on the v7.94 road endpoint and retain a generous
      // finish-safe box so units following the center spline register cleanly.
      cliff.goal={x:66.2,y:142.0};
      cliff.safeZones=Object.assign({},cliff.safeZones,{
        goal:{x0:61.8,y0:137.6,x1:70.6,y1:146.4}
      });
      cliff.strictRoadFollow778=true;
      cliff.roadFollowMode778='route-center-hard';
      cliff.qaGoalLock7941=true;
    }

  }
  applyPatch7941();


  // ============================================================
  // v7.942 — THREE-MAP QA LOCK (Neon Drift + Star Fish + Ice Crown only)
  // Preserve the already-approved geometry while explicitly locking the
  // three user-facing QA requirements. No other map is modified here.
  // ============================================================
  function applyPatch7942(){
    const neon=MAP_DEFINITIONS_770.s_map;
    if(neon){
      // Neon Drift: retain the battle-tested hand-tuned S-map spline. The opening
      // line must not be regenerated by generic route logic, which prevents the
      // 7->5 opening from spreading toward the lower/outside side.
      neon.racingSpline770=S_MAP_RACING_SPLINE_770;
      neon.globalOptimal770=S_MAP_GLOBAL_OPTIMAL_LINE_770;
      neon.openingInsideLock7942=true;
    }

    const star=MAP_DEFINITIONS_770.star_fish;
    if(star){
      // Star Fish: road-edge graphics remain pass-through. Touching/crossing the
      // one-line edge must never trigger wall collision, rollback or a stall.
      star.edgePassThrough786=true;
      star.wallCollision786=false;
      star.edgeRailMode786='visual-pass-through';
      star.starFishNoEdgeRollback895=true;
      star.starFishNoOuterStateTrigger895=true;
      star.edgeFlow785=true;
      star.stallProofSpline784=true;
      star.qaEdgeFlow7942=true;
    }

    const ice=MAP_DEFINITIONS_770.ice_ring;
    if(ice){
      // Ice Crown: normal driving follows the traced gray M-road only. Keep the
      // central non-road interior forbidden so racers cannot climb too far upward
      // or switch onto a visually adjacent path through the crown.
      ice.strictRoadFollow778=true;
      ice.roadFollowMode778='route-center-hard';
      ice.hardForbidden780=true;
      ice.edgeFlow785=true;
      ice.stallProofSpline784=true;
      ice.wideMRoute781=true;
      ice.qaMRouteLock7942=true;
    }
  }
  applyPatch7942();

  // ============================================================
  // v7.943 — FOUR-MAP QA LOCK (Desert Oasis + Heart + retired slot 6 course + Space only)
  // Preserve approved artwork/route behavior and freeze the four QA points.
  // No intentional changes to the other five maps.
  // ============================================================
  function applyPatch7943(){
    const desert=MAP_DEFINITIONS_770.desert_oasis;
    if(desert){
      desert.image='map_desert_oasis_899.png?v=803-theme-tile';
      desert.startArtifactClean899=true;
      desert.mapLoadSafe791=true;
      desert.qaStartClean7943=true;
      desert.qaFirstCornerFlow7943=true;
    }

    const heart=MAP_DEFINITIONS_770.neon_city;
    if(heart){
      heart.image='map_heart_7891_clean.png?v=803-theme-tile';
      heart.sharedGate778=true;
      heart.courseType775='circuit';
      heart.finishRule775='one-lap-gate';
      heart.lapRequired775=true;
      heart.qaSingleRedGate7943=true;
      heart.qaNoExtraBox7943=true;
    }

    const black=MAP_DEFINITIONS_770.double_hairpin;
    if(black){
      black.retiredSlot6CenterOnly895=true;
      black.retiredSlot6HardCenter896=true;
      black.retiredSlot6ExactCenter897=true;
      black.strictRoadFollow778=true;
      black.roadFollowMode778='route-center-hard';
      black.qaSpiralCenter7943=true;
    }

    const space=MAP_DEFINITIONS_770.skyway;
    if(space){
      space.image='map_space_894.png?v=803-theme-tile';
      space.widths770=new Array(Math.max(1,(space.route770||[]).length-1)).fill(11.6);
      space.special=Object.assign({},space.special,{wideRoad:true});
      space.spaceRoadRows897=4;
      space.spaceRoadDoubleWidth897=true;
      space.spaceExtraGateArtRemoved794=true;
      space.qaFourRowRoad7943=true;
      space.qaNoSideBias7943=true;
      const line=conservativeRacingLine778(space);
      space.racingSpline770=line;
      space.globalOptimal770=line;
      space.racingLineMode772='four-row-road-clean-v7.943';
    }
  }
  applyPatch7943();
  // v1.67.0 cleanup: obsolete v7.97 retired-slot Clover patch removed.

  // ============================================================
  // - remove the remaining circular halo-style rock artwork,
  // - replace oversized rectangular collision envelopes with tight circular bodies,
  // - keep rocks 2/3 left-gap only, no stall, and no 5->3 diagonal chord.
  // ============================================================


  // ============================================================
  // - eliminate obstacle correction snaps that looked like teleporting,
  // - shorten no-chord/rejoin lookahead to remove micro-stutter,
  // - force the bottom section to travel through a real 5-o'clock arc before
  //   climbing toward 3 o'clock; no outside excursion + diagonal climb.
  // ============================================================


  // ============================================================
  // - after rock #3, force a real 3->2->1->12 progression on the paved right arc,
  // - add intermediate waypoints so NORMAL AI cannot sight a far upper target and chord inward,
  // - preserve v7.981 no-teleport / short-rejoin continuity behavior.
  // ============================================================


  // ============================================================
  // ============================================================
  function applyPatch799(){


    const cliff=MAP_DEFINITIONS_770.cliff_hanger;
    if(cliff){
      const tail=[
        [62.325,139.278],[65.0,141.0],[68.0,143.5],[71.0,146.0],
        [74.0,149.0],[76.5,152.0],[79.0,155.0],[81.0,157.2]
      ];
      const base=cliff.route770.slice();
      while(base.length && base[base.length-1][1]>136.0) base.pop();
      cliff.route770=base.concat(tail);
      cliff.widths770=new Array(Math.max(1,cliff.route770.length-1)).fill(6.8);
      cliff.goal={x:81.0,y:157.2};
      cliff.safeZones={
        start:{x0:18.942,y0:30.005,x1:26.542,y1:37.605},
        goal:{x0:77.1,y0:153.3,x1:84.9,y1:161.1}
      };
      cliff.strictRoadFollow778=true;
      cliff.roadFollowMode778='route-center-hard';
      const line=conservativeRacingLine778(cliff);
      cliff.racingSpline770=line;
      cliff.globalOptimal770=line;
      cliff.racingLineMode772='lower-right-final-end-v7.99';
      cliff.qaGoalLock799=true;
    }
  }
  applyPatch799();

  // ============================================================
  // v7.991 — ROLLING SOLID ROCKS / TRUE FIVE GATE + SKY CLIFF FINAL ARC
  // ============================================================
  function applyPatch7991(){


    const cliff=MAP_DEFINITIONS_770.cliff_hanger;
    if(cliff){
      // v7.99 accidentally removed the old paved 7->6 approach before appending
      // the new goal tail, creating one large diagonal chord. Restore that entire
      // road-shaped arc, then continue smoothly to the lower-right finish.
      const anchor=cliff.route770.findIndex(q=>Math.abs(q[0]-36.878)<.08&&Math.abs(q[1]-131.902)<.08);
      if(anchor>=0){
        const finalRoadArc=[
          [36.878,131.902],[37.37,136.819],[40.689,140.507],[45.36,142.351],
          [50.278,142.105],[52.736,137.802],[57.407,139.646],[62.325,139.278],
          [64.0,139.8],[66.0,140.8],[68.0,142.0],[70.0,143.4],[72.0,145.2],
          [74.0,147.4],[76.0,149.8],[78.0,152.4],[79.7,154.8],[81.0,157.2]
        ];
        cliff.route770.splice(anchor,cliff.route770.length-anchor,...finalRoadArc);
      }
      cliff.widths770=new Array(Math.max(1,cliff.route770.length-1)).fill(6.55);
      cliff.goal={x:81.0,y:157.2};
      cliff.safeZones={
        start:{x0:18.942,y0:30.005,x1:26.542,y1:37.605},
        goal:{x0:77.1,y0:153.3,x1:84.9,y1:161.1}
      };
      cliff.strictRoadFollow778=true;
      cliff.roadFollowMode778='route-center-hard';
      cliff.lockOptimalExecution784=true;
      const line=densifyLine772(cliff.route770,.055);
      cliff.racingSpline770=line;
      cliff.globalOptimal770=line;
      cliff.racingLineMode772='restored-7to6-road-center-v7.991';
      cliff.cliffFinalCenter7991=true;
      cliff.qaFinalRoad7991=true;
    }
  }
  applyPatch7991();

  // ============================================================
  // ============================================================



  // ============================================================
  // - reduce the no-touch envelope so racers do not overreact around rock tips,
  // - tighten the 6->5->3 paved arc around the actual road center,
  // - retain the physical 5-o'clock checkpoint and no-diagonal rule.
  // ============================================================



  // ============================================================
  // - force the lower road through staged center-road waypoints,
  // - retain flexible rock-edge grazing elsewhere without allowing body cuts.
  // ============================================================



  // ============================================================
  // ============================================================


  // ============================================================
  // - only the inner physical core triggers collision handling,
  // - keep the lower/outside shortcut block and 6->5->3 gate unchanged.
  // ============================================================


  // ============================================================
  // - v7.994's lower/outside rectangle overlapped the legal 9-o'clock road,
  //   causing rock collision + no-go rejection to loop at the same position.
  // - move that block to the true lower-right exterior only, leaving the paved
  //   left-side bypass completely open.
  // ============================================================


  // ============================================================
  // - reaching the final staged 5-o'clock waypoint now marks the gate passed,
  // - prevents the old infinite same-target loop / apparent stop at 5 o'clock,
  // ============================================================


  // ============================================================
  // - remove the overlapping lower/right hard box that could deadlock the racer,
  // - use a nearly full-size solid core so only the extreme visible rim is grazeable,
  // - keep a far-right exterior guard without touching the legal tangent corridor,
  // - reuse the same dual-tangent sliding behavior as rock #1.
  // ============================================================


  // ============================================================
  // - outside/wide routes are no longer valid AI targets,
  // - the normal road center is authoritative everywhere,
  // ============================================================


  // ============================================================
  // - keep the lower 6 -> 5 -> 3 section on dense center-road checkpoints,
  // - forbid the old wide/exterior 5-o'clock corner line.
  // ============================================================



  // ============================================================
  // Two nearby yellow starts share the camera; one green finish sits at the top.
  // ============================================================
  function applyPatch810(){
    const m=MAP_DEFINITIONS_770.triple_diamond;
    if(!m)return;
    m.id='triple_diamond';
    m.slot=9;
    m.name='데스티니 게이트';
    m.en='Destiny Gate';
    m.theme='Heaven vs Hell Destiny Gate';
    m.tags=['데스티니게이트','2스타트','천국vs지옥'];
    m.image='map_destiny_gate_8113.png?v=817-destiny-gate';
    m.imageSize={w:1254,h:1254};
    m.logicalSize={w:178,h:178};
    m.miniCrop={x:0,y:0,w:178,h:178};
    m.dualStarts810=[{x:72.2,y:165.8},{x:105.9,y:165.8}];
    m.start={x:89.05,y:165.8};
    m.goal={x:89.0,y:5.8};
    m.safeZones={start:{x0:67.5,y0:160.5,x1:110.7,y1:171.8},goal:{x0:84.4,y0:1.8,x1:93.8,y1:10.0}};
    m.route770=[
      [80,165],[69,158],[58,149],[50,138],[55,128],[66,118],[78,111],[89,106],
      [101,100],[113,92],[124,82],[129,75],[124,68],[113,58],[101,50],[89,45],
      [77,40],[65,34],[55,27],[50,21],[58,16],[70,12.5],[80,11],[89.1,5.8]
    ];
    m.widths770=new Array(m.route770.length-1).fill(7.2);
    const line=densifyLine772(m.route770,.030);
    m.racingSpline770=line;
    m.globalOptimal770=line;
    m.racingLineMode772='destiny-base-v8.12';
    m.strictRoadFollow778=true;
    m.roadFollowMode778='branch-road-hard';
    m.geometryReady=true;
    m.approvedImageShape772=true;
    m.outerSoftLimit789=true;
    m.insideTune789='destiny-gate-balanced';
    m.courseType775='point-to-point';
    m.finishRule775='end-gate';
    m.lapRequired775=false;
    m.lapArmFraction775=0;
    m.sharedGate778=false;
    m.qaTripleDiamond810=true;
  }
  applyPatch810();

  function applyPatch811(){
    const m=MAP_DEFINITIONS_770.triple_diamond;
    if(!m)return;
    m.name='데스티니 게이트';
    m.en='Destiny Gate';
    m.theme='Heaven vs Hell Destiny Gate';
    m.tags=['데스티니게이트','2스타트','천국vs지옥'];
    m.qaDestinyGate811=true;
    m.dualStarts810=[{x:72.2,y:165.8},{x:105.9,y:165.8}];
    m.start={x:89.05,y:165.8};
    m.goal={x:89.0,y:5.8};
    m.strictRoadFollow778=true;
    m.roadFollowMode778='route-center-hard';
    m.strictNoChord795=true;
    m.outerSoftLimit789=true;
    m.noDiagonalShortcut811=true;
    m.rejoinRoadHard811=true;
    m.racingLineMode772='destiny-gate-road-lock-v8.11';
    m.widths770=new Array(Math.max(1,m.route770.length-1)).fill(7.0);
    const line=densifyLine772(m.route770,.014);
    m.racingSpline770=line;
    m.globalOptimal770=line;
  }
  applyPatch811();


  function applyPatch8113(){
    const m=MAP_DEFINITIONS_770.triple_diamond;
    if(!m)return;
    m.name='데스티니 게이트';
    m.en='Destiny Gate';
    m.image='map_destiny_gate_8113.png?v=817-destiny-gate';
    m.imageSize={w:1254,h:1254};
    m.dualStarts810=[{x:72.2,y:165.8},{x:105.9,y:165.8}];
    m.start={x:89.05,y:165.8};
    m.goal={x:89.0,y:5.8};
    m.safeZones={
      start:{x0:67.5,y0:160.5,x1:110.7,y1:171.8},
      goal:{x0:84.4,y0:1.8,x1:93.8,y1:10.0}
    };
    const M0=[89.05,153.0],M1=[89.05,107.0],M2=[89.05,51.0],G=[89.1,5.8];
    m.destinyRoads813=[
      [[72.2,165.8],M0],[[105.9,165.8],M0],
      [M0,[69,148],[55,138],[60,126],[74,116],M1],
      [M0,[109,148],[123,138],[118,126],[104,116],M1],
      [M1,[72,100],[57,88],[55,76],[68,61],M2],
      [M1,[106,100],[121,88],[123,76],[110,61],M2],
      [M2,[72,44],[58,34],[55,24],[68,14.5],G],
      [M2,[106,44],[120,34],[123,24],[110,14.5],G]
    ];
    m.routeChoiceProbability813=.50;
    m.routeChoiceAtEveryJunction813=true;
    m.naturalMergedJunction813=true;
    m.qaDestinyGate813=true;
    m.strictRoadFollow778=true;
    m.strictNoChord795=true;
    m.roadFollowMode778='branch-road-hard';
    m.racingLineMode772='destiny-gate-3x-5050-v8.113';
  }
  applyPatch8113();

  function applyPatch812(){
    const m=MAP_DEFINITIONS_770.triple_diamond;
    if(!m)return;
    m.name='데스티니 게이트';
    m.en='Destiny Gate';
    m.roadFollowMode778='branch-road-hard';
    m.racingLineMode772='destiny-gate-legacy-pre815';
    m.qaDestinyGate812=true;
  }
  applyPatch812();




  function applyPatch815(){
    const m=MAP_DEFINITIONS_770.triple_diamond;
    if(!m)return;
    const S1=[72.2,165.8],S2=[105.9,165.8];
    // v8.181: merges sit at the visual center-neck of each fork, not at its lower tail.
    const M0=[89.0,122.0],J1=[89.0,111.0],M1=[89.0,72.5],J2=[89.0,61.0],M2=[89.0,19.0],G=[89.0,5.8];
    m.destinyTopology815={
      startRoads:[
        [S1,[67,159],[62,151],[63,143],[69,135],[79,128],M0],
        [S2,[111,159],[116,151],[115,143],[109,135],[99,128],M0]
      ],
      shared0:[M0,[89.0,117],J1],
      branch1:{
        // optimized inside racing line: less unnecessary outer looping
        left:[J1,[78,107],[68,102],[60,96],[57,90],[61,83],[70,78],[80,74],M1],
        right:[J1,[100,107],[110,102],[118,96],[121,90],[117,83],[108,78],[98,74],M1]
      },
      shared1:[M1,[89.0,67],J2],
      branch2:{
        // v8.185: enter the common neck earlier and with shallower angles.
        left:[J2,[78,57],[68,52],[60,46],[58,40],[62,34],[71,28],[80,23],[85,20],M2],
        right:[J2,[100,57],[110,52],[118,46],[120,40],[116,34],[107,28],[98,23],[93,20],M2]
      },
      shared2:[M2,[89.0,16.0],[89.0,12.0],[89.0,8.5],[89.0,5.8]]
    };
    m.destinyRoads813=[
      ...m.destinyTopology815.startRoads,
      m.destinyTopology815.shared0,
      m.destinyTopology815.branch1.left,m.destinyTopology815.branch1.right,
      m.destinyTopology815.shared1,
      m.destinyTopology815.branch2.left,m.destinyTopology815.branch2.right,
      m.destinyTopology815.shared2
    ];
    // Representative route exists only for generic normalized bookkeeping;
    // road legality and actual player motion never use it on this map.
    m.route770=[...m.destinyTopology815.startRoads[0],
      ...m.destinyTopology815.shared0.slice(1),
      ...m.destinyTopology815.branch1.left.slice(1),
      ...m.destinyTopology815.shared1.slice(1),
      ...m.destinyTopology815.branch2.left.slice(1),
      ...m.destinyTopology815.shared2.slice(1)];
    m.widths770=new Array(Math.max(1,m.route770.length-1)).fill(8.4);
    m.racingSpline770=densifyLine772(m.route770,.34);
    m.globalOptimal770=m.racingSpline770;
    m.routeChoiceProbability813=.50;
    m.routeChoiceCount815=2;
    m.routeChoiceAtEveryJunction813=true;
    m.bottomStartLegsFixed815=true;
    m.actualMovementUsesPersonalPath815=true;
    m.progressUsesPersonalPath815=true;
    m.threatFrameUsesPersonalPath815=true;
    m.noLegacyRouteMask815=true;
    m.roadFollowMode778='branch-road-hard';
    m.racingLineMode772='destiny-image-aligned-personal-path-v8.15';
    m.qaDestinyGate815=true;
    rebuildRacingSpline770();
  }
  applyPatch815();



  function applyPatch817(){
    const m=MAP_DEFINITIONS_770.triple_diamond;
    if(m){
      m.name='데스티니 게이트';
      m.en='Destiny Gate';
      m.image='map_destiny_gate_8113.png?v=817-destiny-gate';
      m.imageFallback791='map_destiny_gate_8113.png?v=1630';
      m.qaDestinyAsset817=true;
    }
  }
  applyPatch817();

  function applyPatch816(){
    for(const m of MAP_POOL_770){
      if(!m)continue;
      m.startObserverExclusionRadius816=(m.id==='triple_diamond'?15.5:13.0);
      m.startCollisionProtectionMs816=1000;
      m.startAiBoostMs816=3000;
      m.startAiPredictionBoost816=1.35;
      m.qaStartSafety816=true;
    }
  }
  applyPatch816();


  function applyPatch817PathLock(){
    const m=MAP_DEFINITIONS_770.triple_diamond;
    if(!m)return;
    m.name='데스티니 게이트';
    m.branchChoiceLocked817=true;
    m.personalPathHardLock817=true;
    m.outerRoadEscapeBlocked817=true;
    m.finalGoalTopCenter817=true;
    m.goal={x:89.0,y:5.8};
    m.safeZones={...(m.safeZones||{}),goal:{x0:84.8,y0:1.8,x1:93.2,y1:10.2}};
    m.roadFollowMode778='branch-road-hard-lock';
    m.racingLineMode772='destiny-locked-branch-topgoal-v8.17';
    m.qaDestinyPath817=true;
  }
  applyPatch817PathLock();


  function applyPatch8171(){
    const m=MAP_DEFINITIONS_770.triple_diamond;
    if(!m)return;
    m.name='데스티니 게이트';
    m.routeChoiceProbability813=.50;
    m.routeChoiceCount815=2;
    m.branchChoiceScope8171='per-junction-segment';
    m.branch2Independent8171=true;
    m.exteriorNeverLegal8171=true;
    m.edgeFlex8171=.70;
    m.hardRoadHalfWidth8171=4.55;
    m.roadFollowMode778='branch-hard-boundary';
    m.racingLineMode772='destiny-per-junction-5050-hard-road-v8.171';
    m.qaDestiny8171=true;
  }
  applyPatch8171();


  function applyPatch8172(){
    const m=MAP_DEFINITIONS_770.triple_diamond;
    if(!m)return;
    m.name='데스티니 게이트';
    m.destinyCameraCenterX8172=89.0;
    m.cameraHorizontalLock8172=true;
    m.cameraVerticalLeaderFollow8172=true;
    m.runtimeRoadMaskFixed8172=true;
    m.roadFollowMode778='branch-hard-boundary';
    m.racingLineMode772='destiny-hard-road-center-camera-v8.172';
    m.qaDestiny8172=true;
  }
  applyPatch8172();


  function applyPatch818(){
    const m=MAP_DEFINITIONS_770.triple_diamond;
    if(!m)return;
    m.name='데스티니 게이트';
    m.monotonicPersonalProgress818=true;
    m.allModesPersonalPath818=true;
    m.noEdgeStall818=true;
    m.noAdjacentLegSnap818=true;
    m.noBackwardFork818=true;
    m.innerLineBounded818=true;
    m.destinyMaxLaneNormal818=2.55;
    m.destinyMaxLaneEvade818=2.85;
    m.roadFollowMode778='personal-path-authority';
    m.racingLineMode772='destiny-monotonic-personal-path-v8.18';
    m.qaDestiny818=true;
  }
  applyPatch818();


  function applyPatch8181(){
    const m=MAP_DEFINITIONS_770.triple_diamond;
    if(!m)return;
    m._destinyPathCache8181=Object.create(null);
    m.destinyCachedPaths8181=true;
    m.destinyBinaryLookup8181=true;
    m.destinyNoFrameMaskScan8181=true;
    m.optimizedInsideLine8181=true;
    m.centerMerge8181=true;
    m.mergePoints8181=[[89.0,122.0],[89.0,72.5]];
    m.roadFollowMode778='personal-path-fast';
    m.racingLineMode772='destiny-center-merge-inside-fast-v8.181';
    m.qaDestiny8181=true;
  }
  applyPatch8181();


  function applyPatch8182(){
    const m=MAP_DEFINITIONS_770.triple_diamond;
    if(!m)return;
    m.destinyDedicatedAvoidAi182=true;
    m.destinyThreatPersonalPath182=true;
    m.destinyThreeLaneDecision182=true;
    m.destinyNoGenericEvadeCandidates182=true;
    m.destinyRenderSmoothing182=true;
    m.destinyAuditSampling182=3;
    m.destinyThreatScanMs182=56;
    m.roadFollowMode778='personal-path-smooth-ai';
    m.racingLineMode772='destiny-smooth-personal-ai-v8.182';
    m.qaDestiny8182=true;
  }
  applyPatch8182();


  function applyPatch8183(){
    const m=MAP_DEFINITIONS_770.triple_diamond;
    if(!m)return;
    m.destinyDedicatedUpdateLoop183=true;
    m.destinyNoLegacyPlanner183=true;
    m.destinySingleInterpolation183=true;
    m.destinyNoDoubleCorrection183=true;
    m.destinyThreatScanMs183=72;
    m.roadFollowMode778='dedicated-personal-loop';
    m.racingLineMode772='destiny-dedicated-loop-v8.183';
    m.qaDestiny8183=true;
  }
  applyPatch8183();


  function applyPatch8184(){
    const m=MAP_DEFINITIONS_770.triple_diamond;
    if(!m)return;
    m._destinyPathCache8181=Object.create(null); // rebuild with rounded paths
    m.destinyRoundedPath184=true;
    m.destinyLaneRateLimit184=.085;
    m.destinyEvadePlanHold184=true;
    m.destinyCameraCenterlineY184=true;
    m.destinyTelemetry25Hz184=true;
    m.destinyMiniMap250ms184=true;
    m.roadFollowMode778='dedicated-smooth-motion';
    m.racingLineMode772='destiny-rounded-rate-limited-v8.184';
    m.qaDestiny8184=true;
  }
  applyPatch8184();


  function applyPatch8185(){
    const m=MAP_DEFINITIONS_770.triple_diamond;
    if(!m)return;
    m._destinyPathCache8181=Object.create(null); // topology changed: rebuild cache
    m.destinyMergePreCenter185=true;
    m.destinyMergeLaneRate185=.046;
    m.destinyFinalNeckExtended185=true;
    m.destinyFinalCameraDamp185=true;
    m.racingLineMode772='destiny-merge-smooth-v8.185';
    m.qaDestiny8185=true;
  }
  applyPatch8185();


  function applyPatch820(){
    window.__OBSERVER_FM_ROSTER_820__=names.map((name,index)=>({
      index,
      name,
      stats:{...playerStats[index]}
    }));
  }
  applyPatch820();


  function applyPatch821(){
    window.__OBSERVER_FM_TEAM_LEAGUE_821__={
      rules:{...TEAM_LEAGUE_RULES_821},
      rosters:{
        A:TEAM_LEAGUE_ROSTERS_821.A.map(index=>({index,name:names[index]})),
        B:TEAM_LEAGUE_ROSTERS_821.B.map(index=>({index,name:names[index]}))
      }
    };
  }
  applyPatch821();

  function applyPatch100(){
    window.__OBSERVER_FM_V100__={mode:"team-league",rules:{...LEAGUE_RULES_100}};
  }
  applyPatch100();


  function applyPatch101(){
    window.__OBSERVER_FM_V101__={
      fasterLeagueTransition:true,
      collisionTolerance:0.18,
      robustLeagueScoring:true
    };
  }
  applyPatch101();


  function applyPatch102(){
    window.__OBSERVER_FM_V102__={
      firstClearEndsHeat:true,
      randomizedMapDeck:true,
      leagueFlowAudit:true
    };
  }
  applyPatch102();


  function applyPatch103(){
    window.__OBSERVER_FM_V103__={
      bracketShowsSetMaps:true,
      aceHiddenUntilThreeThree:true,
      oneMapPerSet:true
    };
  }
  applyPatch103();

  function applyPatch104(){
    window.__OBSERVER_FM_V104__={
      greenBracketMapNames:true,
      bluePlayerAlignedToVs:true,
      redPlayerAlignedToVs:true
    };
  }
  applyPatch104();


  function applyPatch105(){
    window.__OBSERVER_FM_V105__={
      teamColorUnified:true,
      teamAColor:"BLUE",
      teamBColor:"RED",
      bracketShiftLeft:true,
      liveRedNameRightAligned:true
    };
  }
  applyPatch105();


  function applyPatch106(){
    window.__OBSERVER_FM_V106__={
      observerCounts:{
        default:100,
        space:70,
        skyCliff:70
      },
      aiFrontReadImproved:true,
      aiEmergencyReactionImproved:true,
      destinyThreatReadImproved:true
    };
  }
  applyPatch106();


  function applyPatch107(){
    const space=MAP_DEFINITIONS_770.skyway;
    if(space){
      space.spaceFreeLane107=true;
      space.spaceReactionBoost107=true;
      space.spaceMaxLane107=2.25;
    }

    window.__OBSERVER_FM_V107__={
      spaceFreeLane:true,
      spaceReactionBoost:true,
      sparseObserverPreRead:true,
      unifiedTeamColor:true
    };
  }
  applyPatch107();


  function applyPatch108(){
    const neon=neonDriftMapId108();
    window.__OBSERVER_FM_V108__={
      mapBanEnabled:true,
      neonBanProtected:true,
      set1NeonFixed:true,
      neonMapId:neon
    };
  }
  applyPatch108();


  function applyPatch109(){
    window.__OBSERVER_FM_V109__={
      survivalPriority:true,
      sparseThreatPriority:true,
      personalRacingLines:true,
      variantDriving:true,
      insideLineSecondary:true
    };
  }
  applyPatch109();


  function applyPatch110(){
    window.__OBSERVER_FM_V110__={
      targetSurvivalMultiplier:"3x-5x",
      deterministicCloseThreat:true,
      hardCloseEveryTick:true,
      widerEmergencyDodge:true,
      survivalOverInsideLine:true
    };
  }
  applyPatch110();


  function applyPatch111(){
    window.__OBSERVER_FM_V111__={
      hardCloseReferenceErrorFixed:true,
      hardDodgeLaneSanitized:true,
      runtimeFreezeFixed:true
    };
  }
  applyPatch111();


  function applyPatch112(){
    window.__OBSERVER_FM_V112__={
      proactiveSafetyField:true,
      hardCloseRangeBoost:true,
      hardDodgeLockMs:1250,
      variantControls:true,
      variantCancelsOnThreat:true,
      mirroredPathReduction:true
    };
  }
  applyPatch112();


  function applyPatch113(){
    window.__OBSERVER_FM_V113__={
      actualLaneMovement:true,
      survivalLaneAuthority:true,
      noCenterSplineOverwrite:true,
      immediateCloseReaction:true,
      visibleControlVariety:true
    };
  }
  applyPatch113();


  function applyPatch114(){
    window.__OBSERVER_FM_V114__={
      dtClampMs:34,
      forwardStepClamp:.42,
      lateralAccelerationLimit:true,
      emergencyDirectionLock:true,
      visualCatchupClamp:true
    };
  }
  applyPatch114();


  function applyPatch115(){
    window.__OBSERVER_FM_V115__={
      safetyFieldCacheMs:90,
      safetyFieldLanes:3,
      safetyFieldHorizons:3,
      roadMaskThrottle:true,
      rankingRenderThrottleMs:80,
      variantCheckMs:250,
      performancePass:true
    };
  }
  applyPatch115();


  function applyPatch116(){
    window.__OBSERVER_FM_V116__={
      cornerTangentSmoothing:true,
      stableSegmentTransition:true,
      cornerLaneDamping:true,
      dtClampMs:24,
      maxCatchupStepsPerFrame:2,
      backlogFastForwardBlocked:true,
      cornerSpeedSmoothing:true
    };
  }
  applyPatch116();


  function applyPatch120(){
    window.__OBSERVER_FM_V120__={
      movementEngine:"UnifiedMovement120",
      singleCoordinateAuthority:true,
      legacyCoordinateCorrectionsBypassed:true,
      statsAffectDriving:true,
      lowProbabilityVariantControls:true,
      survivalOverInsideLine:true,
      maxCatchupSteps:2
    };
  }
  applyPatch120();


  function applyPatch121(){
    window.__OBSERVER_FM_V121__={
      continuousCenterCurve:true,
      persistentHeadingNormal:true,
      filteredRoadWidth:true,
      unifiedCamera:true,
      cameraLeaderHysteresisMs:900,
      maxSimulationStepsPerRender:1,
      noLegacyCameraBattleOffsets:true
    };
  }
  applyPatch121();


  function applyPatch122(){
    window.__OBSERVER_FM_V122__={
      incrementalMovement:true,
      noAbsolutePositionRebuild:true,
      noStopToTurn:true,
      maxSingleTickMove:.32,
      softPathCorrection:true,
      backlogZeroed:true,
      neonVerticalOuterLimit:true
    };
  }
  applyPatch122();


  function applyPatch130(){
    window.__OBSERVER_FM_V130__={
      aiGeneration:"FreeDriving130",
      splineIsReferenceOnly:true,
      localTrajectoryPlanning:true,
      multiObserverPrediction:true,
      committedRouteChoice:true,
      emergencyReplan:true,
      humanLikeControls:["zigzag","wide","hold","feint","cutback"],
      statsAffectPlanning:true,
      survivalPriority:true
    };
  }
  applyPatch130();


  function applyPatch131(){
    window.__OBSERVER_FM_V131__={
      imminentSideEscape:true,
      stoppedObserverAwareness:true,
      stoppedObserverStaticWall:true,
      denseEscapeCandidates:10,
      emergencyLateralBoost:1.32,
      humanControls:["zigzag","wide","hold","feint","cutback","doublemove"],
      humanControlFrequencyRaised:true
    };
  }
  applyPatch131();


  function applyPatch132(){
    window.__OBSERVER_FM_V132__={
      antiMirrorCompetition:true,
      chaseMode:true,
      trailingGapThreshold:"max(7.5, routeLength*5.5%)",
      chaseInsideLinePriority:true,
      chaseSpeedBoost:true,
      stopControl:true,
      variantControlFrequencyRaisedSlightly:true,
      controls:["zigzag","wide","hold","feint","cutback","doublemove","microzig","stop"]
    };
  }
  applyPatch132();


  function applyPatch133(){
    window.__OBSERVER_FM_V133__={
      singleObserverGuaranteedRead:true,
      twoObserverGuaranteedRead:true,
      noProbabilityGateForSimpleThreat:true,
      simpleEscapeHold:true,
      stoppedObserverExtraMargin:true,
      simpleEscapeLateralBoost:1.48,
      antiMirrorSimpleEscape:true
    };
  }
  applyPatch133();


  function applyPatch140(){
    window.__OBSERVER_FM_V140__={
      aiGeneration:"SurvivalMaster140",
      targetSurvival:"90-95%+",
      longHorizonPrediction:true,
      denseLaneSearch:13,
      waitForGap:true,
      survivalAlwaysFirst:true,
      noForcedNarrowGap:true,
      masterEmergencyLateralBoost:1.62
    };
  }
  applyPatch140();


  function applyPatch141(){
    window.__OBSERVER_FM_V141__={
      survivalMasterRuntimeFix:true,
      pythonBooleanLeakFixed:true,
      leagueStartCrashFixed:true
    };
  }
  applyPatch141();


  function applyPatch150(){
    window.__OBSERVER_FM_V150__={
      aiGeneration:"CrowdSurvival150",
      targetSurvival:"~99% goal, not guaranteed",
      observerCountMultiplier:2,
      multiStagePathfinding:true,
      pathStages:3,
      trueStopControl:true,
      waitForGap:true,
      crowdEmergencyLateralBoost:1.78,
      survivalAlwaysFirst:true
    };
  }
  applyPatch150();


  function applyPatch151(){
    window.__OBSERVER_FM_V151__={
      naturalFlowSurvival:true,
      longStopsRemoved:true,
      crowdWaitMs:"70-125",
      rollingAvoidance:true,
      crowdReplanMs:110,
      crowdEmergencyLateralBoost:1.90
    };
  }
  applyPatch151();


  function applyPatch152(){
    window.__OBSERVER_FM_V152__={
      stopControlFrequencyMultiplier:.05,
      slowControlFrequencyMultiplier:.05,
      lateralDodgePriority:true,
      maintainRaceSpeedDuringAvoidance:true,
      naturalEvade:true
    };
  }
  applyPatch152();


  function applyPatch153(){
    window.__OBSERVER_FM_V153__={
      finalCollisionVeto:true,
      plannedPathCheckedEveryTick:true,
      stalePlanCancelledOnThreat:true,
      noProbabilityGate:true,
      vetoHoldMs:260,
      vetoLateralBoost:2.05
    };
  }
  applyPatch153();


  function applyPatch154(){
    window.__OBSERVER_FM_V154__={
      survivalFinalPass:true,
      vetoLookaheadSec:1.16,
      vetoCandidates:14,
      vetoHoldMs:420,
      vetoClearanceRaised:true,
      singleObserverEarlyReadRaised:true,
      crowdSafetyMarginRaised:true,
      reverseEvadeSuppression:true,
      collisionVetoLateralBoost:2.35
    };
  }
  applyPatch154();


  function applyPatch155(){
    window.__OBSERVER_FM_V155__={
      chainEvade:true,
      vetoLookaheadSec:1.42,
      vetoCandidates:16,
      vetoHoldMs:240,
      softHoldBias:true,
      fasterCrowdReplanMs:80,
      chainReactionImproved:true,
      collisionVetoLateralBoost:2.55,
      smoothEmergencyAcceleration:true
    };
  }
  applyPatch155();


  function applyPatch156(){
    window.__OBSERVER_FM_V156__={
      crowdBreakout:true,
      multiObserverImmediateResponse:true,
      crowdBreakoutMinObservers:3,
      openSpaceDensitySearch:true,
      breakoutCandidates:13,
      breakoutHoldMs:180,
      crowdBreakoutLateralBoost:2.70,
      noStopForCrowdBreakout:true
    };
  }
  applyPatch156();


  function applyPatch157(){
    window.__OBSERVER_FM_V157__={
      ultraReaction:true,
      reactionPolicy:"detect-fast-steer-smooth",
      crowdDangerReplanMs:35,
      collisionVetoNearTermSamples:12,
      vetoHoldMs:170,
      breakoutHoldMs:140,
      collisionVetoBoost:2.85,
      crowdBreakoutBoost:3.00,
      smoothSteeringAcceleration:true,
      statsAffectRouteQualityMoreThanDetection:true
    };
  }
  applyPatch157();


  function applyPatch158(){
    window.__OBSERVER_FM_V158__={
      hyperReaction:true,
      reactionPolicy:"near-instant-detect-and-steer",
      crowdDangerReplanMs:16,
      vetoHoldMs:100,
      breakoutHoldMs:90,
      collisionVetoBoost:3.45,
      crowdBreakoutBoost:3.70,
      fastEmergencyAcceleration:true,
      reverseEvadePenaltyMinimal:true
    };
  }
  applyPatch158();


  function applyPatch160(){
    window.__OBSERVER_FM_V160__={
      singleObserverHardEscape:true,
      singleObserverPriority:"absolute",
      singleObserverBoost:3.80,
      antiMirrorStrengthened:true,
      lateralRangeReduced:true,
      conservativeDeadCodeCleanup:true
    };
  }
  applyPatch160();


  function applyPatch161(){
    window.__OBSERVER_FM_V161__={
      humanSurvivalFlow:true,
      continuousSafeCorridor:true,
      corridorLookaheadSec:1.94,
      corridorCandidates:12,
      corridorObserversMax:16,
      finalCollisionVetoStillActive:true,
      corridorLateralBoost:3.10,
      survivalFlowPriority:true
    };
  }
  applyPatch161();


  function applyPatch162(){
    window.__OBSERVER_FM_V162__={
      finalSurvivalTune:true,
      corridorSafetyMarginRaised:true,
      collisionVetoClearanceRaised:true,
      singleObserverSafetyRaised:true,
      safeCorridorBoost:3.25,
      controlVarietyRaisedSlightly:true,
      safeRoadControlChanceRaised:true
    };
  }
  applyPatch162();


  function applyPatch163(){
    window.__OBSERVER_FM_V163__={
      threatBurstAI:true,
      calmWhenClear:true,
      hyperReactiveWhenThreatened:true,
      threatBurstLateralBoost:4.60,
      multiThreatZigzag:true,
      zigzagSwitchMs:"85-120",
      threatBurstNoSlowBias:true
    };
  }
  applyPatch163();


  function applyPatch170(){
    window.__OBSERVER_FM_V170__={
      aiGeneration:"ActualMotionPrediction170",
      reachableTrajectorySimulation:true,
      simUsesCurrentLaneVelocity:true,
      simUsesLateralAcceleration:true,
      simUsesForwardSpeed:true,
      actualMotionEscapePriority:true,
      zigzagReduced:true,
      actualMotionLateralBoost:4.10
    };
  }
  applyPatch170();


  function applyPatch171(){
    window.__OBSERVER_FM_V171__={
      survivalOverOptimalLine:true,
      racingLineInfluenceReduced:true,
      safeCorridorLookaheadSec:2.16,
      actualMotionLookaheadSec:1.85,
      actualMotionObserversMax:18,
      survivalScoreWeightRaised:true,
      emergencySlowdownAllowed:true,
      chaseLineAuthorityReduced:true
    };
  }
  applyPatch171();


  function applyPatch172(){
    window.__OBSERVER_FM_V172__={
      aiGeneration:"UnifiedSurvivalPlanner172",
      oneDangerPlanner:true,
      legacyDangerOverwriteBypassed:true,
      actualReachableTrajectory:true,
      collisionRadiusAligned:true,
      survivalCandidates:15,
      speedCandidates:5,
      observersEvaluatedMax:20,
      survivalPriorityAbsolute:true
    };
  }
  applyPatch172();


  function applyPatch173(){
    window.__OBSERVER_FM_V173__={
      compactEvade:true,
      lateralRangeReducedFurther:true,
      localEscapeFirst:true,
      wideEscapeEmergencyOnly:true,
      survivalPlannerStillUnified:true,
      unifiedSurvivalBoost:3.45,
      humanLikeSmallDodgesPreferred:true
    };
  }
  applyPatch173();


  function applyPatch180(){
    window.__OBSERVER_FM_V180__={
      adaptiveSubstepAI:true,
      clearRoadSubsteps:1,
      threatSubsteps:5,
      internalThreatStepMs:4,
      visibleGameSpeed:1.0,
      playerBaseSpeedUnchanged:true,
      observerBaseSpeedUnchanged:true,
      plannerReevaluatesEveryMicrostep:true,
      sweptCollisionEveryMicrostep:true,
      timeScaledLateralPhysics:true
    };
  }
  applyPatch180();


  function applyPatch181(){
    window.__OBSERVER_FM_V181__={
      dtBasedLateralPhysics:true,
      substepDoubleScalingFixed:true,
      predictionMatchesMovement:true,
      laneVelocityUnits:"lane/sec",
      sameMotionAt20msAnd4ms:true,
      unifiedSurvivalBoost:3.35
    };
  }
  applyPatch181();


  function applyPatch190(){
    window.__OBSERVER_FM_V190__={
      survivalGauntlet:true,
      forcedThreatWaves:6,
      debugDeathTelemetry:true,
      deterministicTestObservers:14,
      waveTypes:[
        "single-front","cross-two","cluster-four",
        "stopped-wall","dual-side-approach","chain-cluster"
      ]
    };
  }
  applyPatch190();


  function applyPatch191(){
    window.__OBSERVER_FM_V191__={survivalAnalytics:true,waveAnalytics:true,deathReasonClassifier:true,recentDeathLogMax:20,avoidSuccessTracking:true,motionStatsTracking:true};
  }
  applyPatch191();


  function applyPatch192(){
    window.__OBSERVER_FM_V192__={
      predictionSensorFix:true,
      observerVelocityClamp:true,
      dangerGridRefreshEveryMicrostep:true,
      directSensorFailsafe:true,
      robustNearbyDirectScan:true,
      realReactionTimeMetric:true,
      predictionVsSensorTelemetry:true
    };
  }
  applyPatch192();


  function applyPatch193(){
    window.__OBSERVER_FM_V193__={
      emergencyEscape:true,
      emergencyPriorityAbsolute:true,
      imminentTTCDetection:true,
      continuousThreatReplan:true,
      contextSpeedChoice:true,
      emergencyLateralBoost:4.60,
      singleThreatEscapeStrengthened:true
    };
  }
  applyPatch193();






































  function applyPatch1107(){
    window.__OBSERVER_FM_V1107__={
      restoredFrom:"v1.10.5",
      fullCodeAudit:true,
      laneZeroFalsyBugFixed:true,
      executionMicroDodgeMinimal:true,
      microDodgeStateTransition:false,
      executionPlanPreserved:true,
      lifecycleMetricUnified:true,
      deadCodeCleanup:true,
      legacyMetadataCleanup:true,
      codeAudit1107:true
    };
  }
  applyPatch1107();


  function applyPatch1108(){
    window.__OBSERVER_FM_V1108__={
      executionTimeoutSeparated:true,
      invalidationReasonSplit:true,
      denseThreatScoring:true,
      denseThreatExtraCandidates:false,
      microDodgeStructurePreserved:true,
      deathReasonExpansion:true,
      performanceProfile:"v1.10.7-preserved",
      codeAudit1108:true
    };
  }
  applyPatch1108();


  function applyPatch1110(){
    window.__OBSERVER_FM_V1110__={
      adaptiveExecutionTimeouts:true,
      stallRescuePartialReplan:true,
      microDodge21:true,
      microDodgeDenseCutoff:5,
      microDodgeTriggerGap:1.35,
      specialControlsSlightlyMoreVisible:true,
      executionStructurePreserved:true,
      codeAudit1110:true
    };
  }
  applyPatch1110();


  function applyPatch1111(){
    window.__OBSERVER_FM_V1111__={
      globalAIAllMaps:true,
      denseThreatPriority:true,
      denseThreatExecutionFirst:true,
      denseThreatMicroDodgeDisabledAt4Plus:true,
      denseThreatEmergencyOnlyCritical:true,
      specialControlsCalmRoadOnly:true,
      neonLegacyAudit:true,
      neonActiveGeometryRetained:true,
      neonUnusedMetadataRemoved:true,
      codeAudit1111:true
    };
  }
  applyPatch1111();


  function applyPatch1113(){
    window.__OBSERVER_FM_V1113__={
      restoredFrom:"v1.11.1",
      normalExecutionCreationUntouched:true,
      overlayBridge:true,
      overlayDoesNotChangeState:true,
      overlayPreservesExecutionPlan:true,
      overlayDurationMs:100,
      denseThreatOverlayOnly:true,
      allMapsSharedAI:true,
      codeAudit1113:true
    };
  }
  applyPatch1113();



  // v1.2.4 canonical per-map Observer population.


  function applyPatch1115(){
    window.__OBSERVER_FM_V1115__={
      aiBehaviorFrozen:true,
      basedOn:"v1.11.4",
      overlayAccountingCentralized:true,
      overlayResumeCountBoundToStart:true,
      overlayAccountingInvariant:"resume <= start",
      executionCoreUnchanged:true,
      emergencyCoreUnchanged:true,
      allMapsSharedAI:true,
      finalFoundationValidation:true,
      codeAudit1115:true
    };
  }
  applyPatch1115();


  window.__OBSERVER_FM_V120__={
    version:"v1.2.4",
    mapObserverCounts:{
      "세잎 클로버":40,"스카이클리프":100,"스페이스":130,"네온드리프트":100,
      "스타피쉬":180,"데스티니게이트":180,"아이스크라운":200,
      "하트":200,"사막오아시스":200
    },
    sharedAIAllMaps:true,
    aiFoundation:"v1.11.5",
    aiBehaviorChanged:false,
    forcedRiskTestButtonRemoved:true
  };


  window.__OBSERVER_FM_V121__={
    version:"v1.2.4",
    calmMovement:true,
    flashyControlsReduced:true,
    noObserverBackControlSuppressed:true,
    idleLaneDeadZone:true,
    aiFoundation:"v1.11.5",
    observerCountsBase:"v1.2.0",neonDriftObserverCount:100
  };


  window.__OBSERVER_FM_V123__={
    version:"v1.2.4",
    legacyObserverQaRemoved:true,
    currentObserverQaAdded:true,
    neonDriftObserverCount:100,
    currentMapObserverCounts:{
      "세잎 클로버":40,"스카이클리프":100,"스페이스":130,"네온드리프트":100,
      "스타피쉬":180,"데스티니게이트":180,"아이스크라운":200,
      "하트":200,"사막오아시스":200
    },
    aiFoundation:"v1.11.5",
    calmMovement:"v1.2.1",
    forcedRiskTestButtonRemoved:true
  };


  window.__OBSERVER_FM_V124__={
    version:"v1.2.4",
    observerCountSingleSource:true,
    canonicalObserverFunction:"observerCountForMap791",
    spawnAndDisplayUnified:true,
    neonDriftActualObservers:100,
    currentMapObserverCounts:{
      "세잎 클로버":40,"스카이클리프":100,"스페이스":130,"네온드리프트":100,
      "스타피쉬":180,"데스티니게이트":180,"아이스크라운":200,
      "하트":200,"사막오아시스":200
    },
    aiBehaviorChanged:false
  };

  // v1.65.0: obsolete v1.3.0/v1.3.1 Clover geometry mutations removed; final Clover authority is below.
  // v1.31.0 — FULL CODE / ASSET AUDIT
  // Removed all remaining retired-course names and asset references.
  // Slot id double_hairpin is intentionally retained as a compatibility key only;
  // its runtime definition is the Three-Leaf Clover from v1.3.0+.
  window.__OBSERVER_FM_V132__={
    version:"v1.32.0",fullCodeAudit:true,retiredCourseReferencesRemoved:true,
    cloverAsset:"map_clover_164.png?v=1640",compatibilityMapId:"double_hairpin"
  };
  // v1.32.0 — stabilization pass: lightweight runtime diagnostics without changing race balance.
  window.__OBSERVER_FM_STABILITY_1320__={version:"v1.32.0",uiOverflowGuard:true,runtimeErrorCapture:true,gameBalanceChanged:false};
  window.addEventListener("error",(e)=>{ window.__OBSERVER_FM_LAST_ERROR_1320__={message:String(e.message||""),source:String(e.filename||""),line:e.lineno||0,col:e.colno||0}; });
  window.addEventListener("unhandledrejection",(e)=>{ window.__OBSERVER_FM_LAST_REJECTION_1320__=String(e.reason&&e.reason.message||e.reason||""); });

  function v36SelfAudit(){
    const issues=[];
    if(!MAP_DEFINITIONS_770.desert_oasis?.qaStartClean7943||!MAP_DEFINITIONS_770.desert_oasis?.startArtifactClean899)issues.push("사막오아시스시작부7943");

    // v1.2.4 current Observer balance QA
    if(observerCountForMap791(MAP_DEFINITIONS_770.double_hairpin)!==150)issues.push("Three-Leaf Clover observer count 150");
    if(observerCountForMap791(MAP_DEFINITIONS_770.cliff_hanger)!==100)issues.push("스카이클리프옵저버100");
    if(observerCountForMap791(MAP_DEFINITIONS_770.skyway)!==130)issues.push("스페이스옵저버130");
    if(observerCountForMap791(MAP_DEFINITIONS_770.s_map)!==100)issues.push("네온드리프트옵저버100");
    if(observerCountForMap791(MAP_DEFINITIONS_770.star_fish)!==180)issues.push("스타피쉬옵저버180");
    if(observerCountForMap791(MAP_DEFINITIONS_770.triple_diamond)!==180)issues.push("데스티니게이트옵저버180");
    if(observerCountForMap791(MAP_DEFINITIONS_770.ice_ring)!==200)issues.push("아이스크라운옵저버200");
    if(observerCountForMap791(MAP_DEFINITIONS_770.neon_city)!==200)issues.push("하트옵저버200");
    if(observerCountForMap791(MAP_DEFINITIONS_770.desert_oasis)!==200)issues.push("사막오아시스옵저버200");
    if(!MAP_DEFINITIONS_770.neon_city?.qaSingleRedGate7943||!MAP_DEFINITIONS_770.neon_city?.sharedGate778||!MAP_DEFINITIONS_770.neon_city?.lapRequired775)issues.push("하트공용게이트7943");
    if(!MAP_DEFINITIONS_770.double_hairpin?.clover130||!MAP_DEFINITIONS_770.double_hairpin?.cloverRightBranch130||!MAP_DEFINITIONS_770.double_hairpin?.cloverCounterClockwise130||MAP_DEFINITIONS_770.double_hairpin?.roadFollowMode778!=="route-center-hard")issues.push("세잎클로버130");
    if(!MAP_DEFINITIONS_770.skyway?.qaFourRowRoad7943||MAP_DEFINITIONS_770.skyway?.spaceRoadRows897!==4||!MAP_DEFINITIONS_770.skyway?.spaceExtraGateArtRemoved794)issues.push("스페이스4줄7943");
    if(!MAP_DEFINITIONS_770.s_map?.openingInsideLock7942||MAP_DEFINITIONS_770.s_map?.racingSpline770!==S_MAP_RACING_SPLINE_770)issues.push("네온드리프트시작인코스7942");
    if(!MAP_DEFINITIONS_770.star_fish?.qaEdgeFlow7942||MAP_DEFINITIONS_770.star_fish?.wallCollision786!==false||!MAP_DEFINITIONS_770.star_fish?.edgePassThrough786||!MAP_DEFINITIONS_770.star_fish?.starFishNoEdgeRollback895)issues.push("스타피쉬끝라인7942");
    if(!MAP_DEFINITIONS_770.ice_ring?.qaMRouteLock7942||!MAP_DEFINITIONS_770.ice_ring?.hardForbidden780||MAP_DEFINITIONS_770.ice_ring?.roadFollowMode778!=="route-center-hard")issues.push("아이스크라운M도로7942");
    if(names.length!==12||new Set(names).size!==12)issues.push("선수12");
    if(OBSERVER_COUNT!==130)issues.push("옵저버기본130");

    if(TEAM_LEAGUE_RULES_821.heatWinsNeeded!==2||TEAM_LEAGUE_RULES_821.maxHeatsPerSet!==3||TEAM_LEAGUE_RULES_821.regularSets!==6||TEAM_LEAGUE_RULES_821.matchWinsNeeded!==4)issues.push("팀리그규칙821");
    if(TEAM_LEAGUE_ROSTERS_821.A.length!==6||TEAM_LEAGUE_ROSTERS_821.B.length!==6||new Set([...TEAM_LEAGUE_ROSTERS_821.A,...TEAM_LEAGUE_ROSTERS_821.B]).size!==12)issues.push("팀리그로스터821");
    if(MAP_POOL_770.length!==9)issues.push("맵풀9-777");
    if(!MAP_POOL_770.every(m=>m.geometryReady&&m.route770&&m.racingSpline770))issues.push("9맵지오메트리");
    if(MAP_POOL_770.some(m=>m.id!=="s_map"&&(m.extraRoads771||[]).length))issues.push("임의지름길");
    if(MAP_POOL_770.some(m=>m.id!=="s_map"&&!m.racingLineMode772))issues.push("레이싱라인정의");
    if(["star_fish","ice_ring"].some(id=>!MAP_DEFINITIONS_770[id]?.optimizedSplineAuthority783||!MAP_DEFINITIONS_770[id]?.stallProofSpline784))issues.push("최적경로권한784");
    if(MAP_DEFINITIONS_770.star_fish?.roadTrace781!=="current-gray-road")issues.push("스타피쉬도로781");
    if(["star_fish","ice_ring"].some(id=>!MAP_DEFINITIONS_770[id]?.insideRoadOnly782||!MAP_DEFINITIONS_770[id]?.optimizedSplineAuthority783||!MAP_DEFINITIONS_770[id]?.shortestLegal783||!MAP_DEFINITIONS_770[id]?.safeShortest784||!MAP_DEFINITIONS_770[id]?.stallProofSpline784||!MAP_DEFINITIONS_770[id]?.edgeFlow785))issues.push("끝라인자연주행권한785");
    if(!MAP_DEFINITIONS_770.ice_ring?.wideMRoute781)issues.push("아이스넓은길781");
    if([...CIRCUIT_MAPS_775].some(id=>!MAP_DEFINITIONS_770[id]?.lapRequired775))issues.push("폐회로완주775");
    if([...POINT_TO_POINT_MAPS_775].some(id=>MAP_DEFINITIONS_770[id]?.lapRequired775))issues.push("P2P완주775");
    if([...CIRCUIT_MAPS_775].some(id=>!MAP_DEFINITIONS_770[id]?.sharedGate778))issues.push("공용빨강게이트778");
    if(MAP_POOL_770.some(m=>m.id!=="s_map"&&!m.strictRoadFollow778))issues.push("도로추종778");
    if(MAP_POOL_770.some(m=>m.id!=="s_map"&&m.id!=="triple_diamond"&&m.roadFollowMode778!=="route-center-hard")||MAP_DEFINITIONS_770.triple_diamond?.roadFollowMode778!=="dedicated-smooth-motion")issues.push("하드경로778");
    if(!MAP_DEFINITIONS_770.ice_ring?.hardForbidden780)issues.push("아이스금지구역780");
    {const td=MAP_DEFINITIONS_770.triple_diamond;
      if(!td?.qaDestiny8185||!td?.destinyMergePreCenter185||!td?.destinyFinalNeckExtended185||!td?.destinyFinalCameraDamp185)issues.push("데스티니8185");
      if(!td?.qaDestiny8184||!td?.destinyRoundedPath184||!td?.destinyEvadePlanHold184||!td?.destinyCameraCenterlineY184||!td?.destinyTelemetry25Hz184)issues.push("데스티니8184");
      if(!td?.qaDestiny8183||!td?.destinyDedicatedUpdateLoop183||!td?.destinyNoLegacyPlanner183||!td?.destinySingleInterpolation183||!td?.destinyNoDoubleCorrection183)issues.push("데스티니8183");
      if(!td?.qaDestiny8182||!td?.destinyDedicatedAvoidAi182||!td?.destinyThreatPersonalPath182||!td?.destinyThreeLaneDecision182||!td?.destinyNoGenericEvadeCandidates182||!td?.destinyRenderSmoothing182)issues.push("데스티니8182");
      if(!td?.qaDestiny8181||!td?.destinyCachedPaths8181||!td?.destinyBinaryLookup8181||!td?.destinyNoFrameMaskScan8181||!td?.optimizedInsideLine8181||!td?.centerMerge8181)issues.push("데스티니8181");
      if(!td?.qaDestiny818||!td?.monotonicPersonalProgress818||!td?.allModesPersonalPath818||!td?.noEdgeStall818||!td?.noAdjacentLegSnap818||!td?.noBackwardFork818)issues.push("데스티니818");
      if(!td?.qaDestiny8172||!td?.runtimeRoadMaskFixed8172||!td?.cameraHorizontalLock8172||!td?.cameraVerticalLeaderFollow8172)issues.push("데스티니8172");
      if(!td?.qaDestiny8171||td.routeChoiceProbability813!==.50||td.routeChoiceCount815!==2||!td.branch2Independent8171||!td.exteriorNeverLegal8171)issues.push("데스티니8171");
      if(!td?.qaDestinyPath817||!td?.branchChoiceLocked817||!td?.personalPathHardLock817||!td?.outerRoadEscapeBlocked817||!td?.finalGoalTopCenter817)issues.push("데스티니경로817");
      if(!td?.qaDestinyGate812||td?.id!=="triple_diamond"||!Array.isArray(td?.dualStarts810)||td.dualStarts810.length!==2)issues.push("데스티니게이트8113");
      if(td?.image!=="map_destiny_gate_8113.png?v=817-destiny-gate"||!td?.qaDestinyAsset817)issues.push("데스티니게이트이미지817");
      if(td?.lapRequired775!==false||td?.finishRule775!=="end-gate")issues.push("데스티니게이트완주8113");
      if(td?.routeChoiceProbability813!==.50||td?.routeChoiceCount815!==2||!td?.routeChoiceAtEveryJunction813||!Array.isArray(td?.destinyRoads813)||td.destinyRoads813.length!==9)issues.push("데스티니게이트분기815");
      if(!td?.qaDestinyGate815||!td?.actualMovementUsesPersonalPath815||!td?.progressUsesPersonalPath815||!td?.threatFrameUsesPersonalPath815||!td?.noLegacyRouteMask815)issues.push("데스티니게이트개인경로815");
    }
    if(!MAP_DEFINITIONS_770.skyway?.spaceExtraGateArtRemoved794)issues.push("스페이스사각형794");
    if([1,2,3,4,5].some(r=>RACER_KEYS.some(k=>!unitSprites[r]?.[k])))issues.push("유닛스프라이트817");
    return {ok:!issues.length,issues,build:BUILD_ID};
  }

  window.ObserverFMRaceEngine={
    version:BUILD_ID,selfAudit:v36SelfAudit,
    getPerformance:()=>({fps:diagFps,frameMs:diagFrameMs,maxFrameMs:diagMaxFrameMs,fpsProtectLevel}),
    schema:"observer-fm-race-result@1",
    getRules:()=>clonePlain(engineCoreRules()),
    getLastResult:()=>lastMasterResult?clonePlain(lastMasterResult):null,
    getRoster820:()=>names.map((name,index)=>({index,name,stats:{...playerStats[index]}})),
    getLeagueState100:()=>clonePlain(leagueState100()),
    resetLeague100:()=>clonePlain(resetLeague100()),
    proceedLeague100:()=>{beginLeagueSet100();return clonePlain(leagueState100());},
    getTeamLeagueRules821:()=>({
      rules:{...TEAM_LEAGUE_RULES_821},
      rosters:{
        A:TEAM_LEAGUE_ROSTERS_821.A.map(index=>({index,name:names[index]})),
        B:TEAM_LEAGUE_ROSTERS_821.B.map(index=>({index,name:names[index]}))
      }
    }),
    resetTeamLeague821:()=>resetTeamLeague821(),
    getTeamLeagueState821:()=>teamLeagueState821(),
    awardTeamLeagueHeat821:(team)=>awardTeamLeagueHeat821(team),
    getCurrentState:()=>({build:BUILD_ID,matchMode,running,paused,currentRound,simClock,
      mapId:currentMap770().id,mapName:currentMap770().name,observerCount:observers.length,
      teamScores:isTeamMode()?{RED:teamTotals.RED,BLUE:teamTotals.BLUE}:null,finished:players.filter(p=>p.done).length}),
    getMapImageStatus791:()=>({complete:!!map.complete,naturalWidth:map.naturalWidth||0,src:map.src||"",fallback:map._fallback791||""}),
    testLateMapLoadSafety791:()=>{const before={running,round:currentRound,mapId:currentMap770().id};map.dispatchEvent(new Event("load"));return {before,after:{running,round:currentRound,mapId:currentMap770().id}};},
    startCurrent:start,resetMatch:reset,
    runStatLab739,
    getStatProfiles739:()=>players.map(p=>({name:p.name,stats:{...p.stats},skill:{...driverSkill739(p)}})),
    getAnalytics749:()=>players.map(p=>playerAnalytics749(p)),
    getCareerAnalytics749:(name)=>careerAnalytics749(name),
    resetAnalytics749:()=>{try{localStorage.removeItem(ANALYTICS_KEY_749);}catch(e){} return true;},
    getDrivingPersonality754:()=>players.map(p=>({name:p.name,...driverPersonality754(p)})),
    getPersonalityFinal759:()=>players.map(p=>({name:p.name,...personalitySummary759(p)})),
    getRivalContexts759:()=>players.map(p=>({name:p.name,...rivalContext759(p),rival:rivalContext759(p).rival?.name||null})),
    getUnitSpecs764:()=>clonePlain(UNIT_CHASSIS_764),
    getCurrentUnit764:()=>clonePlain(unitChassis764()),
    getUnitCompatibility769:(name)=>{const p=players.find(x=>x.name===name)||players[0];return p?clonePlain(unitCompatibility769(p)):null;},
    getUnitStats769:()=>clonePlain(unitStats769()),
    resetUnitStats769:()=>{try{localStorage.removeItem(UNIT_STATS_KEY_769);}catch(e){}return true;},
    getMapPool770:()=>clonePlain(mapPoolPublic770()),
    getCurrentMap770:()=>clonePlain({
      id:currentMap770().id,slot:currentMap770().slot,name:currentMap770().name,en:currentMap770().en,
      theme:currentMap770().theme,tags:[...(currentMap770().tags||[])],
      geometryReady:!!currentMap770().geometryReady,start:{...mapStart770()},goal:{...mapGoal770()},
      special:{...(currentMap770().special||{})},
      miniCrop774:{...miniCrop770()},
      extraRoadCount771:(currentMap770().extraRoads771||[]).length,
      racingLineMode772:currentMap770().racingLineMode772||"unknown",
      roadFollowMode778:currentMap770().roadFollowMode778||"legacy",
      approvedImageShape772:!!currentMap770().approvedImageShape772,
      courseType775:currentMap770().courseType775||"point-to-point",
      finishRule775:currentMap770().finishRule775||"end-gate",
      lapRequired775:!!currentMap770().lapRequired775,
      startFinishDistance775:Math.hypot(mapGoal770().x-mapStart770().x,mapGoal770().y-mapStart770().y),
      routeLength,splineLength:RACING_SPLINE_LENGTH_720
    }),
    selectMap770,
    getMapSelectUI774:()=>({
      value:mapSelect774?.value||null,
      optionCount:mapSelect774?.options?.length||0,
      options:mapSelect774?[...mapSelect774.options].map(o=>({value:o.value,text:o.textContent,disabled:o.disabled})):[]
    }),
    getLapRules775:()=>MAP_POOL_770.map(m=>({
      id:m.id,name:m.name,type:m.courseType775||"point-to-point",
      lapRequired:!!m.lapRequired775,finishRule:m.finishRule775||"end-gate",
      start:{...(m.start||{})},finish:{...(m.goal||{})},
      startFinishDistance:Math.hypot((m.goal?.x||0)-(m.start?.x||0),(m.goal?.y||0)-(m.start?.y||0))
    })),
    getLapState775:()=>players.map(p=>({
      name:p.name,checkpoint:!!p._lapCheckpoint775,
      armed:!!p._lapArmed775,complete:!!p._lapComplete775,
      maxFraction:p._lapMaxFraction775||0,done:!!p.done
    })),
    getMapQA777:()=>MAP_POOL_770.map(m=>({
      id:m.id,name:m.name,world:{...(m.logicalSize||{})},imageSize:{...(m.imageSize||{})},
      start:{...(m.start||{})},finish:{...(m.goal||{})},miniCrop:{...(m.miniCrop||{})},
      routePoints:m.route770?.length||0,roadWidth:Number(m.widths770?.[0]||0),
      courseType:m.courseType775||"point-to-point",lapRequired:!!m.lapRequired775
    })),
    getMapQA780:()=>MAP_POOL_770.map(m=>({
      id:m.id,name:m.name,en:m.en,image:m.image,world:{...(m.logicalSize||{})},imageSize:{...(m.imageSize||{})},
      start:{...(m.start||{})},finish:{...(m.goal||{})},miniCrop:{...(m.miniCrop||{})},
      routePoints:m.route770?.length||0,widthCount:m.widths770?.length||0,roadWidth:Number(m.widths770?.[0]||0),
      forbiddenCount:(m.forbiddenZones770||[]).length,hardForbidden:!!m.hardForbidden780,
      strictRoadFollow:!!m.strictRoadFollow778,roadFollowMode:m.roadFollowMode778||"legacy",
      racingLineMode:m.racingLineMode772||"unknown",sharedGate:!!m.sharedGate778,
      courseType:m.courseType775||"point-to-point",lapRequired:!!m.lapRequired775
    })),

    getTeleportAudit754:()=>players.map(p=>({
      name:p.name,trips:p._teleportGuardTrips754||0,
      backtrackPrevented:p._backtrackPrevented754||0,
      topOffsetFlipPrevented:p._topOffsetFlipPrevented754||0,
      splineRepairs770:p._splineRepair770||0,stallProofRecoveries784:p._stallProofRecoveries784||0,
      outerSoftRecoveries789:p._outerSoftRecoveries789||0,hardObstacleBlocks780:p._hardObstacleBlocks780||0,
      events:(p._teleportEvents754||[]).map(x=>({...x})),
      splineProgress:p._splineProg720||0,mode:p._raceState720?.mode||"NORMAL",
      action:p._raceState720?.action||"none",x:p.x,y:p.y
    }))
  };

  // v7.91 MAP LOAD SAFETY:
  // Selecting a map already resets the round synchronously.  A late PNG load must
  // never reset an already-started race (large Desert/Sky Cliff assets exposed it).
  map.addEventListener("load",()=>{
    if(!players.length)reset();
    syncMapSelect774();
    lastMiniMapRender=0;
    renderMiniMap(true);
    if(players.length)render(0);
  });
  map.addEventListener("error",()=>{
    const fb=map._fallback791||"";
    if(!fb)return;
    const fbFile=fb.split("?")[0];
    let current="";
    try{current=(new URL(map.src||"",document.baseURI)).pathname.split("/").pop()||"";}catch(e){}
    if(current!==fbFile)map.src=fb;
  });
  if(map.complete&&map.naturalWidth>0){
    if(!players.length)reset();
    syncMapSelect774();
    lastMiniMapRender=0;
    renderMiniMap(true);
  }

  window.ObserverFMStats = { advancedStats697, getAll:()=>players.map(p=>({name:p.name,...(advancedStats697(p)||{})})) };


  // v1.67.0 cleanup: obsolete v1.42 Clover geometry override removed.

  // One capture-phase pointer handler makes map/player cards react immediately
  // on mouse and touch, even after the bracket HTML is re-rendered.
  document.addEventListener('pointerdown',e=>{
    const mapEl=e.target.closest?.('.league-map-open-140[data-map-id]');
    if(mapEl && mapEl.dataset.mapId){ e.preventDefault(); openLeagueMap140(mapEl.dataset.mapId); return; }
    const playerEl=e.target.closest?.('.league-player-open-140[data-source-index]');
    if(playerEl && !playerEl.disabled){ e.preventDefault(); openLeaguePlayer140(Number(playerEl.dataset.sourceIndex)); }
  },true);

  // ============================================================
  // v1.67.0 — CANONICAL DISPLAY LABELS
  // Geometry/image mutations formerly mixed into v1.42 were removed.
  // ============================================================
  (function(){
    const labels={
      s_map:'ObserverS', star_fish:'Star Fish', ice_ring:'Ice Crown',
      desert_oasis:'Desert Oasis', neon_city:'Heart', double_hairpin:'Three-Leaf Clover',
      skyway:'Space', cliff_hanger:'Sky Cliff', triple_diamond:'Destiny Gate'
    };
    for(const m of MAP_POOL_770){
      const label=labels[m.id]||m.en||m.name;
      m.name=label; m.en=label;
    }
    if(mapSelect774){
      for(const opt of mapSelect774.options){
        const m=MAP_DEFINITIONS_770[opt.value];
        if(m) opt.textContent=`${m.slot}. ${m.name}`;
      }
    }
  })();

  // v1.67.0 cleanup: obsolete v1.43 Clover image/observer override removed.

  // Bracket is z-index 10000. Map/player modals must sit above it so the
  // information appears immediately instead of only becoming visible after
  // "Proceed Set" hides the bracket.
  function bringLeagueModalToFront1430(modal){
    if(!modal)return;
    modal.style.zIndex='20050';
    modal.style.pointerEvents='auto';
  }
  const _openLeagueMap1430=openLeagueMap140;
  openLeagueMap140=function(mapId){
    _openLeagueMap1430(mapId);
    bringLeagueModalToFront1430(document.getElementById('leagueMapModal140'));
  };
  const _openLeaguePlayer1430=openLeaguePlayer140;
  openLeaguePlayer140=function(sourceIndex){
    _openLeaguePlayer1430(sourceIndex);
    bringLeagueModalToFront1430(document.getElementById('playerModal'));
  };

  // v1.67.0 cleanup: obsolete v1.45 Clover geometry override removed; Space camera behavior retained.

  // Space is unusually tall/narrow. A little extra zoom removes the visible
  // right-side canvas gutter while keeping the common 300% zoom elsewhere.
  const _getView1440=getView;
  getView=function(){
    if(currentMap770()?.id!=='skyway') return _getView1440();
    const W=canvas.width,H=canvas.height;
    const fitScale=Math.min(W/MAP_W,H/MAP_H);
    const scale=fitScale*3.28;
    const viewW=W/scale,viewH=H/scale;
    const a=running?renderAlpha730:1;
    const rcx=lerp730(prevCamX730,camX,a),rcy=lerp730(prevCamY730,camY,a);
    let sx=rcx-viewW/2,sy=rcy-viewH/2;
    sx=Math.max(0,Math.min(MAP_W-viewW,sx)); sy=Math.max(0,Math.min(MAP_H-viewH,sy));
    return {sx,sy,viewW,viewH,scale};
  };



  // ============================================================
  // v1.63.0 — MAP SYSTEM CLEANUP STEP 2 / CANONICAL MAP IDS
  // One id per current map. Unknown ids are errors, never ObserverS aliases.
  // ============================================================
  const CANONICAL_MAP_IDS_1630=[
    "s_map","star_fish","ice_ring","desert_oasis","neon_city",
    "double_hairpin","skyway","cliff_hanger","triple_diamond"
  ];
  (function(){
    const issues=[];
    for(const id of CANONICAL_MAP_IDS_1630){
      if(!MAP_DEFINITIONS_770[id])issues.push(`missing:${id}`);
    }
    const poolIds=MAP_POOL_770.map(m=>m?.id).filter(Boolean);
    if(new Set(poolIds).size!==poolIds.length)issues.push("duplicate-map-id");
    for(const id of poolIds){
      if(!CANONICAL_MAP_IDS_1630.includes(id))issues.push(`noncanonical:${id}`);
    }
    if(MAP_DEFINITIONS_770.neon_city?.name==="ObserverS")issues.push("heart-aliased-as-observers");
    if(issues.length)console.error("[v1.70.0] map registry audit",issues);
    window.__OBSERVER_FM_MAP_IDS_1630__={ids:[...CANONICAL_MAP_IDS_1630],issues};
  })();

  // ============================================================
  // v1.62.0 — MAP SYSTEM CLEANUP STEP 1 / CLOVER SINGLE AUTHORITY
  // This block is INSIDE the main game scope and is the final Clover definition.
  // All dead post-IIFE Clover patches from v1.45-v1.53 are removed from this build.
  // ============================================================
  (function(){
    const clover=MAP_DEFINITIONS_770.double_hairpin;
    if(!clover) throw new Error('v1.62.0: Three-Leaf Clover definition missing');
    const r=[
      [73.5,162.6],[68,157],[66,147],[66,137],[66,126],[64,117],
      [55,112],[44,111],[34,107],[25,101],[19,93],[15,83],[14,73],[17,63],[23,55],[31,49],[41,45],[51,45],[60,49],[67,55],
      [72,50],[69,42],[67,33],[68,24],[73,17],[80,12],[89,10],
      [98,12],[105,17],[110,24],[111,33],[109,42],[106,50],
      [111,55],[118,49],[127,45],[137,45],[147,49],[155,55],[161,63],[164,73],[163,83],[159,93],[153,101],[144,107],[134,111],[123,112],[114,117],
      [112,126],[112,137],[112,147],[110,157],[104.4,162.7]
    ];
    Object.assign(clover,{
      name:'Three-Leaf Clover',en:'Three-Leaf Clover',
      image:'map_clover_164.png?v=1700',imageSize:{w:1254,h:1254},logicalSize:{w:178,h:178},miniCrop:{x:0,y:0,w:178,h:178},
      route770:r,widths770:new Array(r.length-1).fill(9.8),
      start:{x:73.5,y:162.6},goal:{x:104.4,y:162.7},
      safeZones:{start:{x0:68,y0:157,x1:79,y1:169},goal:{x0:99,y0:157,x1:110,y1:169}},
      sharedGate778:false,hideRuntimeSharedGate7992:true,courseType775:'point-to-point',finishRule775:'end-gate',lapRequired775:false,
      strictRoadFollow778:true,strictNoChord795:true,roadFollowMode778:'clover-v162-single-centre-route',
      extraRoads771:[],forbiddenZones770:[],roadMask770:undefined,observerCount797:150,
      clover130:false,cloverRightBranch130:false,cloverCounterClockwise130:false,
      cloverOrderLock147:false,cloverDirectSplineMovement148:false
    });
    // v1.70.0 cleanup step 6: purge every retired slot-6 flag left by v7.x patches.
    // These flags belonged to the deleted spiral/Black-Hole-era course and must never
    // influence the current point-to-point Three-Leaf Clover steering.
    for(const key of [
      'retiredSlot6Reverse787','retiredSlot6LaneTight893','retiredSlot6SingleYellow894',
      'retiredSlot6CenterOnly895','retiredSlot6HardCenter896','retiredSlot6ExactCenter897'
    ]) delete clover[key];
    const centre=densifyLine772(r,.10);
    clover.racingSpline770=centre;
    clover.globalOptimal770=centre;
    clover.lockOptimalExecution784=true;
    clover.optimizedSplineAuthority783=true;
    clover.racingLineMode772='yellow-9-11-12-1-3-5-green-v162';
    POINT_TO_POINT_MAPS_775.add('double_hairpin');
    CIRCUIT_MAPS_775.delete('double_hairpin');
    clover.geometryReady=true;
    // Do not silently reinterpret Clover as ObserverS. If selected, keep this exact definition.
    if(activeMapId770==='double_hairpin'){
      activeMap770=clover;
      route=r.map(p=>[...p]); widths=[...clover.widths770];
      GLOBAL_OPTIMAL_LINE_710=centre; RACING_SPLINE_720=centre;
      rebuildRouteGeometry770(); rebuildGlobalOptimal770(); rebuildRacingSpline770();
      applyMapImage770(clover);
    }
    window.__OBSERVER_FM_MAP_CLEANUP_1630__={
      cloverSingleAuthority:true,deadPostIifePatchesRemoved:true,
      cloverStart:{...clover.start},cloverGoal:{...clover.goal},observerCount:150
    };
  })();

  // ============================================================
  // v1.65.0 — MAP CLEANUP STEP 3 / LATE-MAP CANONICAL AUDIT
  // The working v1.64 runtime geometry is preserved. This audit makes the
  // final Heart / Space / Destiny / Clover authorities explicit and catches
  // regressions without silently substituting ObserverS.
  // ============================================================
  (function(){
    const issues=[];
    const heart=MAP_DEFINITIONS_770.neon_city;
    const space=MAP_DEFINITIONS_770.skyway;
    const destiny=MAP_DEFINITIONS_770.triple_diamond;
    const clover=MAP_DEFINITIONS_770.double_hairpin;
    if(!heart||!String(heart.image||'').startsWith('map_heart_7891_clean.png')) issues.push('heart-asset');
    if(!space||!String(space.image||'').startsWith('map_space_894.png')) issues.push('space-asset');
    if(!destiny||!String(destiny.image||'').startsWith('map_destiny_gate_8113.png')) issues.push('destiny-asset');
    if(!clover||!String(clover.image||'').startsWith('map_clover_164.png')) issues.push('clover-asset');
    if(clover&&(clover.sharedGate778||clover.lapRequired775||clover.courseType775!=='point-to-point')) issues.push('clover-course-mode');
    if(clover&&(Math.abs(clover.start.x-73.5)>.01||Math.abs(clover.goal.x-104.4)>.01)) issues.push('clover-gates');
    if(destiny&&(!destiny.qaDestiny8185||destiny.roadFollowMode778!=='dedicated-smooth-motion')) issues.push('destiny-final-authority');
    window.__OBSERVER_FM_MAP_CLEANUP_1660__={version:'v1.70.0',issues,obsoleteClover130131Removed:true,obsoleteClover142145Removed:true,lateMapBehaviorPreserved:true,retiredSlot6FlagsPurged:true};
    if(issues.length) console.error('[v1.70.0] late-map audit',issues);
  })();

  // v1.70.0 starts on the randomized matchup board.
  resetLeague100();
})();
