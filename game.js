
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
  const OBSERVER_COUNT = 130;
  const HIT_CHANCE = 1.00;
  const STUN_MS = 0;
  const INV_MS = 0;
  const CAMERA_ZOOM = 3.00;
  const BUILD_ID = "v7.895";
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

  const names = ["Angel","Egle","GhostRider","Bacilius","Zino","Chotbul","Kaka","Pika","HongKey","TaeHyeon","DVA","LiveCam"];
  if(povSelect){
    povSelect.innerHTML=`<option value="-1">POV: OFF</option>`+names.map((n,i)=>`<option value="${i}">${n} POV</option>`).join("");
    povSelect.addEventListener("change",()=>{povPlayerIndex=+povSelect.value;});
  }
  const colors = ["#66e3ff","#ffdb66","#ff7a8a","#9b8cff","#72f0a7","#ff9f5c","#f275ff","#b6f06e","#4df0d0","#ffb86b","#7dd3fc","#c4b5fd"];

  // v29: 20 FM-style attributes + individual driving personality.
  // Values are fixed for this build so a player's identity does not reroll on refresh.
  // v7.33 FIXED ALL-STAT EXPERIMENT
  const playerStats = [
    {pace:30,acceleration:30,cornering:30,insideLine:30,routeReading:30,avoidance:30,reaction:30,prediction:30,control:30,stability:30,braking:30,recovery:30,consistency:30,focus:30,aggression:30,riskControl:30,pressure:30,start:30,endurance:30,luck:30}, // Angel · ALL 30
    {pace:60,acceleration:60,cornering:60,insideLine:60,routeReading:60,avoidance:60,reaction:60,prediction:60,control:60,stability:60,braking:60,recovery:60,consistency:60,focus:60,aggression:60,riskControl:60,pressure:60,start:60,endurance:60,luck:60}, // Egle · ALL 60
    {pace:90,acceleration:90,cornering:90,insideLine:90,routeReading:90,avoidance:90,reaction:90,prediction:90,control:90,stability:90,braking:90,recovery:90,consistency:90,focus:90,aggression:90,riskControl:90,pressure:90,start:90,endurance:90,luck:90}, // GhostRider · ALL 90
    {pace:60,acceleration:60,cornering:60,insideLine:60,routeReading:60,avoidance:60,reaction:60,prediction:60,control:60,stability:60,braking:60,recovery:60,consistency:60,focus:60,aggression:60,riskControl:60,pressure:60,start:60,endurance:60,luck:60}, // Bacilius · ALL 60
    {pace:90,acceleration:90,cornering:90,insideLine:90,routeReading:90,avoidance:90,reaction:90,prediction:90,control:90,stability:90,braking:90,recovery:90,consistency:90,focus:90,aggression:90,riskControl:90,pressure:90,start:90,endurance:90,luck:90}, // Zino · ALL 90
    {pace:60,acceleration:60,cornering:60,insideLine:60,routeReading:60,avoidance:60,reaction:60,prediction:60,control:60,stability:60,braking:60,recovery:60,consistency:60,focus:60,aggression:60,riskControl:60,pressure:60,start:60,endurance:60,luck:60}, // Chotbul · ALL 60
    {pace:80,acceleration:80,cornering:80,insideLine:80,routeReading:80,avoidance:80,reaction:80,prediction:80,control:80,stability:80,braking:80,recovery:80,consistency:80,focus:80,aggression:80,riskControl:80,pressure:80,start:80,endurance:80,luck:80}, // Kaka · ALL 80
    {pace:60,acceleration:60,cornering:60,insideLine:60,routeReading:60,avoidance:60,reaction:60,prediction:60,control:60,stability:60,braking:60,recovery:60,consistency:60,focus:60,aggression:60,riskControl:60,pressure:60,start:60,endurance:60,luck:60}, // Pika · ALL 60
    {pace:60,acceleration:60,cornering:60,insideLine:60,routeReading:60,avoidance:60,reaction:60,prediction:60,control:60,stability:60,braking:60,recovery:60,consistency:60,focus:60,aggression:60,riskControl:60,pressure:60,start:60,endurance:60,luck:60}, // HongKey · ALL 60
    {pace:60,acceleration:60,cornering:60,insideLine:60,routeReading:60,avoidance:60,reaction:60,prediction:60,control:60,stability:60,braking:60,recovery:60,consistency:60,focus:60,aggression:60,riskControl:60,pressure:60,start:60,endurance:60,luck:60}, // TaeHyeon · ALL 60
    {pace:60,acceleration:60,cornering:60,insideLine:60,routeReading:60,avoidance:60,reaction:60,prediction:60,control:60,stability:60,braking:60,recovery:60,consistency:60,focus:60,aggression:60,riskControl:60,pressure:60,start:60,endurance:60,luck:60}, // DVA · ALL 60
    {pace:60,acceleration:60,cornering:60,insideLine:60,routeReading:60,avoidance:60,reaction:60,prediction:60,control:60,stability:60,braking:60,recovery:60,consistency:60,focus:60,aggression:60,riskControl:60,pressure:60,start:60,endurance:60,luck:60}, // LiveCam · ALL 60
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
  function unitAdaptationOf(p){
    const u=unitChassis764(),fit=unitCompatibility769(p);
    return {
      name:u.name,fit:fit.fit,fitGrade:fit.grade,
      safety:1,apex:u.cornerGrip*fit.cornerMul,click:u.evadeResponse*fit.evadeMul,think:1,
      steer:u.turn*fit.turnMul,
      pace:1, // compatibility never grants hidden raw-speed bonus
      chassis764:u,compatibility769:fit
    };
  }

  const signatureMoves={apexHunter:{label:"INSIDE APEX",inside:1.24,skim:1.18},safeReader:{label:"SAFE ARC",inside:.82,skim:1.04},attacker:{label:"THREAD ATTACK",inside:1.08,skim:1.30},lineMaster:{label:"PERFECT LINE",inside:1.30,skim:1.14},balanced:{label:"ADAPTIVE",inside:1,skim:1},controller:{label:"CONTROL CUT",inside:.90,skim:1.06},patient:{label:"WAIT & CUT",inside:.92,skim:1.08},opportunist:{label:"GAP HUNTER",inside:1.16,skim:1.26}};
  function signatureOf(p){return signatureMoves[p.drivingStyle?.style]||signatureMoves.balanced;}



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
    {id:"rubber_duck",slot:2,name:"러버덕",en:"Rubber Duck",theme:"Character Theme Park",
      tags:["캐릭터","장애물","테마"],geometryReady:false,
      special:{shortcuts:true,obstacles:true,wideRoad:false,multiRoute:true,verticality:false},observerProfile:"theme-park"},
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
    {id:"cliff_hanger",slot:9,name:"클리프 행거",en:"Cliff Hanger",theme:"High Cliff",
      tags:["절벽","초협로","고난도지름길"],geometryReady:false,
      special:{shortcuts:true,obstacles:false,wideRoad:false,multiRoute:true,verticality:true},observerProfile:"precision"},
    {id:"river_cross",slot:10,name:"리버 크로스",en:"River Cross",theme:"River & Bridges",
      tags:["분기","다리","전략"],geometryReady:false,
      special:{shortcuts:false,obstacles:true,wideRoad:true,multiRoute:true,verticality:false},observerProfile:"crossing"},
    {id:"industrial_zone",slot:11,name:"산업지대",en:"Industrial Zone",theme:"Heavy Industry",
      tags:["장애물","기믹","테크니컬"],geometryReady:false,
      special:{shortcuts:false,obstacles:true,wideRoad:false,multiRoute:false,verticality:false},observerProfile:"industrial"}
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
    if(m.image && !map.src.endsWith(m.image.split("?")[0]))map.src=m.image;
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
  let teamAssignments={};
  let activeSourceIndexes=[];
  const INDIVIDUAL_COLORS=["#ff4d4d","#4d8dff","#ffd84d","#39d46a","#66e3ff","#b06cff","#9aa0a6","#ff9f43"];
  let teamTotals={A:0,B:0,C:0,D:0};
  let playerTournament={};
  let roundHistory=[];
  let tournamentHighlights=[];
  let roundTransitioning=false;
  let lastMasterResult=null;

  function clonePlain(v){ return JSON.parse(JSON.stringify(v)); }

  const STAT_EXPERIMENT_733={
    Angel:30,GhostRider:90,Zino:90,Kaka:80,default:60
  };

  function engineCoreRules(){
    return {build:BUILD_ID,observerCount:OBSERVER_COUNT,playerCount:8,
      playerHitRadius:unitChassis764().hitRadius,stunMs:STUN_MS,invMs:INV_MS,
      cameraZoom:CAMERA_ZOOM,simHz:Math.round(1000/SIM_STEP_MS),
      playerCollision:false,safeZoneInvulnerability:true,
      baseSpeedMultiplier:1.566903319,
      statExperiment733:{...STAT_EXPERIMENT_733},
      statLabRoster739:["Angel","GhostRider","Zino","Kaka","Egle","Bacilius","Chotbul","Pika"],
      personalityEngine:"Driver Personality Engine FINAL v7.59",
      unitEngine:"Unit Engine FINAL v7.69",
      mapEngine:"Approved 11 Map Geometry + Racing Line Generator v7.72 · Map Select UI v7.74",
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
      const pt=playerTournament[index]||{rounds:[],total:0,team:teamAssignments[index]||"A"};
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
      rules:engineCoreRules(),match:{rounds:roundHistory.length,
        teamScores:{A:teamTotals.A,B:teamTotals.B,C:teamTotals.C,D:teamTotals.D},winnerTeam,
        margin:teamRows.length>1?Math.max(0,teamRows[0].score-teamRows[1].score):0},
      players:playerResults,
      unitStats769:unitStats769(),
      rounds:roundHistory.map(r=>({round:r.round,unit769:clonePlain(r.unit769||null),
        team:{A:r.team.A,B:r.team.B,C:r.team.C,D:r.team.D},
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
    // v7.39 controlled 8-racer stat lab roster:
    // 30: Angel / 90: GhostRider,Zino / 80: Kaka / 60: Egle,Bacilius,Chotbul,Pika.
    activeSourceIndexes=[0,2,4,6,1,3,5,7];
    teamAssignments={};
    activeSourceIndexes.forEach((src,pos)=>teamAssignments[pos]=RACER_KEYS[pos]);
  }

  function initTournament(){
    currentRound=1;
    teamTotals={A:0,B:0,C:0,D:0};
    roundHistory=[]; tournamentHighlights=[]; lastMasterResult=null;
    window.__OBSERVER_FM_LAST_RESULT__=null; playerTournament={};
    activeSourceIndexes.forEach((src,i)=>{
      playerTournament[i]={name:names[src],team:RACER_KEYS[i],total:0,rounds:[],sourceIndex:src};
    });
  }

  function teamLabel(team){ return team==="A" ? "빨강팀" : team==="B" ? "파랑팀" : team==="C" ? "노랑팀" : "초록팀"; }

  const TEAM_COLORS={A:"#ff4d4d",B:"#4d8dff",C:"#ffd84d",D:"#39d46a",E:"#66e3ff",F:"#b06cff",G:"#9aa0a6",H:"#ff9f43"};
  function teamColor(team){return TEAM_COLORS[team]||"#ffffff";}
  function teamStandings(){
    return ["A","B","C","D"].map(team=>({team,score:Number(teamTotals[team]||0)}))
      .sort((a,b)=>b.score-a.score||a.team.localeCompare(b.team));
  }
  function teamWinner(){
    const rows=teamStandings();
    return rows.length>1&&rows[0].score===rows[1].score?null:rows[0].team;
  }

  function rebuildTournamentStandings(){
    const totals={A:0,B:0,C:0,D:0};
    const rebuilt={};
    names.forEach((name,i)=>{
      rebuilt[i]={name,team:teamAssignments[i]||"A",total:0,rounds:[]};
    });
    for(const r of roundHistory){
      totals.A+=Number(r.team?.A||0);
      totals.B+=Number(r.team?.B||0);
      totals.C+=Number(r.team?.C||0);
      totals.D+=Number(r.team?.D||0);
      for(const x of (r.players||[])){
        const row=rebuilt[x.index];
        if(!row) continue;
        row.team=x.team;
        row.total+=Number(x.points||0);
        row.rounds.push({
          round:r.round,rank:x.rank,points:x.points,time:x.time,rating:x.rating||0
        });
      }
    }
    teamTotals=totals;
    playerTournament=rebuilt;
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
        index:i,sourceIndex:src,name,color:INDIVIDUAL_COLORS[i],profile:pf,stats,drivingStyle,team:RACER_KEYS[i],
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
        x:spawn770.x, y:spawn770.y,
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
        hitFxUntil:0, visualAngle:0, prevX:spawn770.x, prevY:spawn770.y, simPrevX:spawn770.x, simPrevY:spawn770.y,
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
        lastX:spawn770.x,
        lastY:spawn770.y,
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

  function spawnObservers(){
    const arr=[];
    const avgPlayerSpeed=9.72;
    const baseSpeed=avgPlayerSpeed*OBS_SPEED_RATIO;
    observerDensityZones=makeObserverDensityZones();

    for(let i=0;i<OBSERVER_COUNT;i++){
      const spawn=densitySpawnPoint();
      const o={
        id:i,
        x:spawn.x,
        y:spawn.y,
        vx:0, vy:0,
        speed:baseSpeed*(0.98+Math.random()*0.04),
        phase:"move",
        phaseUntil:0,
        // Stagger phases so 650 observers do not stop simultaneously.
        cycleOffset:Math.random()*(OBS_MOVE_MS+OBS_STOP_MS),
        pattern712:["free","sweep","diagonal","cross"][i%4]
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
    players.forEach(forceStartCenter625);
    observers=spawnObservers();
    running=false;
    raceStart=0; lastTs=0; lastRankingRender=0; simClock=0; simAccumulator=0; simTickCounter=0;
    lastLeaderName=""; raceEventText=""; raceEventUntil=0; bestSector=[null,null,null];
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
    {const sp770=mapStart770();camX=sp770.x;camY=sp770.y;}
    prevCamX730=camX; prevCamY730=camY;
    renderAlpha730=1;
    players.forEach(p=>{p.simPrevX=p.x;p.simPrevY=p.y;p._renderLastX730=p.x;p._renderLastY730=p.y;});
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
        const fastStartNorm=Math.max(.64,Math.min(.94,.72+openingSkill*.14+start*.05+microBand));
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

  function optimalOffsetFor(p){
    const si=Math.min(p.seg,segs.length-1);
    const cur=segs[si];
    const next=segs[Math.min(segs.length-1,si+1)];
    const half=widths[si]*0.72;

    if(!next) return 0;
    const turn=cur.ux*next.uy-cur.uy*next.ux;
    const lineSkill=(p.profile.line-85)/15; // ~0.2 to ~0.75
    if(Math.abs(turn)<0.035){
      return p.desiredOffset*(0.30-lineSkill*0.12);
    }
    // Better line skill clips the apex more precisely.
    const apex=0.82 + lineSkill*0.15;
    return (turn>0 ? 1 : -1)*half*apex;
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
      if(x>=z.x1-pad && x<=z.x2+pad && y>=z.y1-pad && y<=z.y2+pad) return true;
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

  function courseAwareTarget(p,si,tx,ty){
    // Keep the optimized target if the entire chord is legal. Extreme-inside attempts
    // get the same route-derived margin used by death logic, but still cannot chord
    // across unrelated roads / red gaps.
    const planExtra=(p&&p.extremeInsideActive)
      ? DEATH_EDGE_EXTRA+(p.extremeInsideFail?1.15:-0.48)
      : ROUTE_PLAN_EXTRA;
    if(lineStaysOnCourse(p.x,p.y,tx,ty,planExtra)) return {x:tx,y:ty};
    const s=segs[si];
    const baseX=s.b[0]+s.nx*p.desiredOffset;
    const baseY=s.b[1]+s.ny*p.desiredOffset;
    for(const keep of [.72,.52,.34,.18,0]){
      const cx=baseX+(tx-baseX)*keep;
      const cy=baseY+(ty-baseY)*keep;
      if(lineStaysOnCourse(p.x,p.y,cx,cy,planExtra)) return {x:cx,y:cy};
    }
    return {x:baseX,y:baseY};
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


  function rescueIfStuck(p,now){
    const prog=currentProgress(p);

    // v4.03: no edge-wall anti-stall correction; air units have no wall to fight.
    if(prog > p.lastProgress + 0.18){
      p.lastProgress=prog;
      p.lastAdvanceAt=now;
      p.lastX=p.x; p.lastY=p.y;
      return;
    }

    if(!p.lastAdvanceAt) p.lastAdvanceAt=now;
    if(now-p.lastAdvanceAt < STUCK_RESCUE_MS) return;

    // v3.56: preserve the anti-stuck recovery but NEVER use desiredOffset
    // to relocate sideways. Advance only a small amount along the CURRENT
    // segment while preserving the racer's actual lateral position.
    const si=Math.min(p.seg,segs.length-1);
    const s=segs[si];
    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    let along=rx*s.ux+ry*s.uy;
    const actualLateral=rx*s.nx+ry*s.ny;
    along=Math.max(0,Math.min(s.L,along+0.72));
    const rescueX96=s.a[0]+s.ux*along+s.nx*actualLateral;
    const rescueY96=s.a[1]+s.uy*along+s.ny*actualLateral;
    p.x=rescueX96;
    p.y=rescueY96;
    p.controlMode="normal";
    p.controlUntil=0;
    p.avoidPlanUntil=0;
    p.lastProgress=currentProgress(p);
    p.lastAdvanceAt=now;
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

  function nearestThreats(raw,p,limit=6){
    const obs=threatObserverBuffers[p.index];
    const ds=threatDistanceBuffers[p.index];
    obs.length=0; ds.length=0;
    for(let ri=0;ri<raw.length;ri++){
      const o=raw[ri];
      const dx=o.x-p.x, dy=o.y-p.y;
      const d=dx*dx+dy*dy;
      let pos=ds.length;
      if(pos<limit){
        ds.push(d); obs.push(o);
      }else if(d>=ds[pos-1]){
        continue;
      }else{
        pos=limit-1;
      }
      while(pos>0 && d<ds[pos-1]){
        if(pos<limit){ ds[pos]=ds[pos-1]; obs[pos]=obs[pos-1]; }
        pos--;
      }
      ds[pos]=d; obs[pos]=o;
      if(ds.length>limit){ ds.length=limit; obs.length=limit; }
    }
    return obs;
  }
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

  function humanCommandDelayMs(p,urgency=0){
    const reactionN=Math.max(0,Math.min(1,(p.stats.reaction-72)/27));
    const controlN=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const focusN=Math.max(0,Math.min(1,(p.stats.focus-72)/27));
    const skill=reactionN*.52+controlN*.30+focusN*.18;
    const base=110-skill*55-urgency*20;
    return Math.max(28,Math.min(130,base+(Math.random()-.5)*24));
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

  function openingFastLineTarget(p,si){
    // v4.16 GENERIC START-STRAIGHT OPTIMIZER:
    // During the opening portion of the race, read the first meaningful upcoming
    // corner and move toward its inside edge immediately. This is based on route
    // topology/progress only — no map screenshot coordinates or hand-authored points.
    // It makes a long opening straight become a smooth diagonal toward the fastest
    // wall-side line instead of staying in the middle until the bend.
    const ratio=Math.max(0,Math.min(1,currentProgress(p)/Math.max(1,routeLength)));
    if(ratio>.22) return null;
    let side=0, power=0, cornerSeg=-1;
    for(let k=0;k<10;k++){
      const idx=Math.min(route.length-2,si+k);
      const cs=cornerInsideSide(idx);
      const cp=cornerIntensity(idx);
      if(cs!==0 && cp>.032){ side=cs; power=cp; cornerSeg=idx; break; }
    }
    if(!side) return null;

    // Only force the line while we are still on the approach to that first turn.
    // As the turn gets closer, commitment grows smoothly toward the legal edge.
    const segGap=Math.max(0,cornerSeg-si);
    const proximity=Math.max(0,1-Math.min(1,segGap/9));
    const insideSkill=Math.max(0,Math.min(1,(p.stats.insideLine-72)/27));
    const readSkill=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
    const controlSkill=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*1.08);
    const commit=Math.min(.995,.91+insideSkill*.045+readSkill*.018+controlSkill*.012+proximity*.018+power*.025);
    // v4.194: stable per-racer opening bands. +1 = extreme inside, 0 = central-fast,
    // negative = lower/wider variant. This is a route choice, not random steering jitter.
    const identity=Math.max(-.72,Math.min(1,p.openingLineBias??.25));
    const strength=p.openingLineStrength||.9;
    // v4.62: personal opening identities now vary inside a fast corridor only.
    // Even the widest archetype stays on the correct side of the opening approach.
    const signedCommit=(.72 + identity*.12)*strength;
    return side*half*Math.max(.58,Math.min(.998,commit*signedCommit));
  }

  function futureInsideBias(si){
    let score=0, weight=0;
    for(let k=0;k<4;k++){
      const idx=Math.min(route.length-2,si+k);
      const side=cornerInsideSide(idx);
      const power=cornerIntensity(idx);
      if(side!==0 && power>0.025){
        const w=1/(1+k*0.55);
        score+=side*power*w;
        weight+=power*w;
      }
    }
    if(weight<0.01) return 0;
    return Math.max(-1,Math.min(1,score/weight));
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

function driverStyle68Line(p,si,baseOff,passActive=false){
    if(passActive) return baseOff; // a genuine pass may temporarily need another corridor
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const half=Math.max(1.8,widths[idx]*ROAD_MARGIN*.965);
    const side=cornerInsideSide(idx);
    const insideN=Math.max(0,Math.min(1,(p.stats.insideLine-72)/27));
    const cornerN=Math.max(0,Math.min(1,(p.stats.cornering-72)/27));
    const controlN=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const readN=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
    const id=identityOf(p);
    const styleTight=Math.max(-.025,Math.min(.030,(id.apex-1)*.12));
    const precision=insideN*.34+cornerN*.28+controlN*.20+readN*.18;

    if(side && cornerIntensity(idx)>.028){
      const commit=Math.min(.998,.900+precision*.078+styleTight);
      const target=side*half*commit;
      const authority=Math.min(.96,.82+precision*.11);
      return clampRoadOffset(idx,baseOff*(1-authority)+target*authority,p);
    }

    // On the approach straight, attach to the upcoming inside early rather than
    // preparing from the outside. This reproduces the short-path Observer Dodge feel.
    const future=nextMeaningfulCorner64(idx,4);
    if(future){
      const commit=Math.min(.965,.72+insideN*.12+readN*.10+styleTight);
      const target=future.side*half*commit;
      const proximity=Math.max(0,1-(future.gap-1)/4);
      const authority=Math.min(.90,.42+proximity*.38+readN*.08);
      return clampRoadOffset(idx,baseOff*(1-authority)+target*authority,p);
    }
    return baseOff;
  }

function leaderLineDiscipline67(p,si){
    const rs=liveRaceSituation(p);
    const macro=optimalRacingLine2Offset(p,si);
    // v4.68: leader discipline follows the shortest-inside refined route as well.
    const soloBase=cornerPhysics64Target(p,si,macro).off;
    const solo74=integratedFastLine74(p,si,soloBase);
    const solo=raceLine79(p,si,solo74,false);
    const leadBattle=(rs.rank===1 && rs.nearestBehindGap<7.5) ||
                     (rs.rank===2 && rs.nearestAheadGap<7.5);
    return {rs,solo,leadBattle};
  }

  // v4.67 SURVIVAL × RACING UNIFIED POLICY:
  // Avoidance may leave the fast line only when the predicted threat justifies it.
  // Leaders/P2 in a close fight pay an extra route-cost penalty, so they make compact
  // dodges and return to the racing line immediately instead of taking huge arcs.
  function unifiedLine67(p,si,baseOff,avoid){
    const info=leaderLineDiscipline67(p,si);
    if(!avoid) return {off:baseOff,speedMul:1};
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.57);
    const deviation=Math.abs(avoid.targetOff-info.solo);
    const maxNormal=half*.58; // v4.81 minimum-dodge cap
    const maxLead=half*.40; // v4.82 leaders preserve inside line
    const cap=info.leadBattle?maxLead:maxNormal;
    let off=avoid.targetOff;
    if(deviation>cap){
      off=info.solo+Math.sign(avoid.targetOff-info.solo)*cap;
    }
    // Only true close-clearance emergencies may use more of the road.
    // Avoidance risk scores are not normalized, so minimum predicted clearance is
    // the reliable signal for whether a larger dodge is genuinely necessary.
    const emergency=(Number.isFinite(avoid.minClear) && avoid.minClear<.90) ||
                    avoid.mode==="stop";
    if(emergency){
      const emergencyCap=info.leadBattle?half*.66:half*.86;
      const d=avoid.targetOff-info.solo;
      off=info.solo+Math.sign(d)*Math.min(Math.abs(d),emergencyCap);
    }
    return {off,speedMul:avoid.speedMul||1};
  }

function chooseAvoidanceLegacy84(p,s,now){
    if(safeAt(p.x,p.y)){
      p.avoidPlanUntil=0;
      return null;
    }

    // Keep the current decision briefly so overlapping racers do not trigger
    // frame-by-frame left/right oscillation.
    if(now < p.avoidPlanUntil){
      return {
        mode:p.avoidPlanSpeedMul<=0.03 ? "stop" : "planned",
        targetOff:p.avoidPlanOffset,
        speedMul:p.avoidPlanSpeedMul,
        risk:p.avoidPlanRisk
      };
    }

    const pack=packAwareness(p,s);
    const packVisionBoost=pack.mates>=2 ? 1.18+pack.density*.12 : 1;
    const ownVision=Math.min(AVOID_SCAN_RADIUS,(p.visionRadius||AVOID_SCAN_RADIUS)*packVisionBoost);
    const nearbyRaw=playerPerceivedObservers(p,ownVision);
    // v4.19 CLOSE-REACTION GATE: do not pre-dodge observers far down the road.
    // A human-like racer keeps the optimized line until an observer is genuinely close.
    const imminentRaw=nearbyRaw.filter(o=>{
      const dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy, lat=Math.abs(dx*s.nx+dy*s.ny);
      const d=Math.hypot(dx,dy);
      // v4.40 survival-first: begin reading obvious front threats before the last-second zone.
      // This is deliberately wider than the old gate; physical collision remains HIT 0.56.
      return d<8.8 || (along>-2.4 && along<15.0 && lat<7.8);
    });
    if(!imminentRaw.length){ p.avoidPlanUntil=0; return null; }
    const sharedRaw=imminentRaw.filter(o=>{
      const dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy, lat=Math.abs(dx*s.nx+dy*s.ny);
      return Math.hypot(dx,dy)<9.1 || (along>-2.4 && along<15.3 && lat<8.0);
    });
    if(!sharedRaw.length) return null;

    // v3.63: a pack tracks a broader slice of the obstacle field. Solo behavior
    // stays essentially unchanged; dense packs keep up to nine meaningful threats.
    const threatLimit=pack.mates>=3?20:pack.mates>=2?17:14;
    const nearby=nearestThreats(sharedRaw,p,threatLimit);

    // v4.59.1 LONE-OBSERVER SURVIVAL HOTFIX:
    // One readable observer on the racing corridor is a mandatory fundamentals dodge,
    // even when all 8 racers overlap. Do not let pack state or leader pace suppress it.
    const loneFront=[];
    const loneRoadHalf=Math.max(2.4,widths[Math.min(p.seg,widths.length-1)]*ROAD_MARGIN);
    for(const o of nearby){
      const dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy, lat=dx*s.nx+dy*s.ny;
      if(along>-.35 && along<20.5 && Math.abs(lat)<Math.min(8.8,loneRoadHalf*1.18)){
        const rvx=(o.vx||0)-s.ux*p.speed, rvy=(o.vy||0)-s.uy*p.speed;
        const rv2=rvx*rvx+rvy*rvy;
        let tc=99,cpa=99;
        if(rv2>.01){
          tc=Math.max(0,Math.min(4.10,-(dx*rvx+dy*rvy)/rv2));
          cpa=Math.hypot(dx+rvx*tc,dy+rvy*tc);
        }
        const closingDot=dx*rvx+dy*rvy;
        // v4.59.3 PRECISION SURVIVAL: do not flee merely because one observer is visually ahead.
        // Commit early only when closest-approach predicts collision, or when a stationary/slow
        // obstacle truly occupies the forward lane. This trims cowardly over-avoidance.
        const direct=Math.abs(lat)<3.85 && along<18.6 && (closingDot<0 || Math.hypot(o.vx||0,o.vy||0)<.35);
        if((tc<3.82 && cpa<4.18) || direct) loneFront.push({o,along,lat,tc,cpa});
      }
    }
    if(loneFront.length===1){
      const th=loneFront[0];
      const skill=Math.max(0,Math.min(1,(((p.stats.avoidance+p.stats.reaction+p.stats.prediction+p.stats.control)/4)-72)/27));
      const leadT=Math.max(.72,Math.min(2.9,th.tc<90?th.tc:th.along/Math.max(4.8,p.speed)));
      const predX=predictedObserverX(th.o,leadT), predY=predictedObserverY(th.o,leadT);
      const predLat=(predX-p.x)*s.nx+(predY-p.y)*s.ny;
      const clearance=4.38+skill*.78; // v4.59.3 survival-first: sacrifice a little optimal line for a clean pass
      const leftTarget=clampRoadOffset(Math.min(p.seg,widths.length-1),predLat-clearance,p);
      const rightTarget=clampRoadOffset(Math.min(p.seg,widths.length-1),predLat+clearance,p);
      const leftRisk=candidateAvoidanceRisk(p,s,leftTarget,.998,nearby);
      const rightRisk=candidateAvoidanceRisk(p,s,rightTarget,.998,nearby);
      let chosen=leftRisk.score<=rightRisk.score?{off:leftTarget,r:leftRisk}:{off:rightTarget,r:rightRisk};
      // If both candidate scores are close, use a persistent per-racer side signature so
      // eight overlapping racers do not all choose the exact same dodge arc.
      if(Math.abs(leftRisk.score-rightRisk.score)<1.55){
        // Persistent racer signature rather than per-frame randomness. routeBand/style make
        // an overlapping pack split naturally without turning the dodge into random noise.
        const signature=(p.routeBand||0)+(p.openingLineBias||0)*.65+(p.index%2?.18:-.18);
        const sig=signature===0?((p.index||0)%2?-1:1):Math.sign(signature);
        chosen=sig<0?{off:leftTarget,r:leftRisk}:{off:rightTarget,r:rightRisk};
      }
      if(chosen.r.minClear>.96){
        p.avoidPlanOffset=chosen.off;
        p.avoidPlanSpeedMul=.998;
        p.avoidPlanRisk=chosen.r.score;
        p.avoidPlanUntil=now+Math.max(980,Math.min(1580,th.along*92)); // v4.59.3 commit to the safe side; less left-right wobble
        p.avoidLastSide=Math.sign(chosen.off-p.desiredOffset)||p.avoidLastSide||1;
        p.avoidExitSide=p.avoidLastSide;
        p.avoidExitUntil=p.avoidPlanUntil+900;
        p.avoidSideLockUntil=p.avoidPlanUntil+180; // v4.59.3 keep chosen side unless new danger clearly invalidates it
        p.match.avoids++; p.match.simpleDodges=(p.match.simpleDodges||0)+1;
        return {mode:"planned",targetOff:chosen.off,speedMul:.998,risk:chosen.r.score,minClear:chosen.r.minClear,loneObserverHotfix:true};
      }
    }

    // v3.6 SIMPLE READ DODGE:
    // If exactly one observer is the only meaningful front threat and there is
    // open road on either side, read its predicted motion early and glide around
    // it. This branch intentionally avoids stop/back controls on an easy road.
    const simpleFront=[];
    const simpleRoadHalf=Math.max(2.4,widths[Math.min(p.seg,widths.length-1)]*ROAD_MARGIN);
    for(const o of nearby){
      const dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy;
      const lat=dx*s.nx+dy*s.ny;
      if(along>.15 && along<14.4 && Math.abs(lat)<Math.min(7.2,simpleRoadHalf*1.04)){
        simpleFront.push({o,along,lat});
      }
    }
    if(simpleFront.length===1 && pack.mates<2){
      const th=simpleFront[0];
      // Do not call this "easy" if another observer is close enough to interfere
      // with either escape lane.
      let interfering=0;
      for(const o of nearby){
        if(o===th.o) continue;
        const dx=o.x-p.x,dy=o.y-p.y;
        const along=dx*s.ux+dy*s.uy;
        const lat=Math.abs(dx*s.nx+dy*s.ny);
        if(along>-1.5 && along<13.8 && lat<simpleRoadHalf*1.14) interfering++;
      }
      if(interfering===0){
        const skill=Math.max(0,Math.min(1,
          (((p.stats.avoidance+p.stats.reaction+p.stats.prediction+p.stats.control)/4)-72)/27));
        const leadT=Math.max(.72,Math.min(2.65,th.along/Math.max(4.8,p.speed)));
        const predX=predictedObserverX(th.o,leadT);
        const predY=predictedObserverY(th.o,leadT);
        const pdx=predX-p.x,pdy=predY-p.y;
        const predLat=pdx*s.nx+pdy*s.ny;
        // v4.40 virtual safety radius: on an open road, do not skim an isolated observer.
        const clearance=3.55+skill*.78;
        const leftTarget=Math.max(-simpleRoadHalf*.97,Math.min(simpleRoadHalf*.97,predLat-clearance));
        const rightTarget=Math.max(-simpleRoadHalf*.97,Math.min(simpleRoadHalf*.97,predLat+clearance));
        const leftRisk=candidateAvoidanceRisk(p,s,leftTarget,.995,nearby);
        const rightRisk=candidateAvoidanceRisk(p,s,rightTarget,.995,nearby);
        const chosen=leftRisk.score<=rightRisk.score
          ? {off:leftTarget,r:leftRisk}
          : {off:rightTarget,r:rightRisk};

        // Skilled racers should almost never miss an isolated, obvious observer.
        // Lower-skill racers retain a small human-like error chance.
        // v4.40: isolated readable observers are a fundamentals check, not a dice roll.
        // If a legal lane has real clearance, commit to it deterministically.
        if(chosen.r.minClear>1.20){
          p.avoidPlanOffset=chosen.off;
          p.avoidPlanSpeedMul=.995;
          p.avoidPlanRisk=chosen.r.score;
          p.avoidPlanUntil=now+Math.max(720,Math.min(1280,th.along*78));
          p.avoidLastSide=Math.sign(chosen.off-p.desiredOffset)||p.avoidLastSide||1;
          p.avoidExitSide=p.avoidLastSide;
          p.avoidExitUntil=p.avoidPlanUntil+720;
          p.avoidSideLockUntil=p.avoidPlanUntil;
          p.match.avoids++;
          p.match.simpleDodges=(p.match.simpleDodges||0)+1;
          return {mode:"planned",targetOff:chosen.off,speedMul:.995,
            risk:chosen.r.score,minClear:chosen.r.minClear,simpleDodge:true};
        }
      }
    }

    // v3.63 PACK SURVIVAL: when racers overlap, make the obstacle-field decision
    // before individual reactive controls. The safest corridor is risk-tested against
    // shared observer predictions and held longer to prevent an entire pack from
    // marching down one doomed line.
    if(pack.mates>=2){
      const cp=observerClusterPlan(p,s,nearby);
      if(cp.frontCount>=1 || cp.closeCount>=1){
        const roadHalf=Math.max(2.4,widths[Math.min(p.seg,widths.length-1)]*ROAD_MARGIN);
        const bias=(p.index%3-1)*roadHalf*.055; // tiny deterministic diversity, not body avoidance
        const packTarget=clampRoadOffset(Math.min(p.seg,widths.length-1),cp.preferredOffset+bias,p);
        const pr=candidateAvoidanceRisk(p,s,packTarget,.982,nearby);
        if(pr.minClear>.72 || cp.emergency){
          p.avoidPlanOffset=packTarget;
          p.avoidPlanSpeedMul=cp.emergency?.965:.982;
          p.avoidPlanRisk=pr.score;
          p.avoidPlanUntil=now+390+pack.density*260+Math.random()*90;
          p.avoidLastSide=Math.sign(packTarget-p.desiredOffset)||p.avoidLastSide||1;
          p.avoidExitSide=p.avoidLastSide;
          p.avoidExitUntil=p.avoidPlanUntil+360;
          p.avoidSideLockUntil=p.avoidPlanUntil;
          p.match.avoids++;
          p.match.packDodges=(p.match.packDodges||0)+1;
          return {mode:"planned",targetOff:packTarget,speedMul:p.avoidPlanSpeedMul,
            risk:pr.score,minClear:pr.minClear,packSurvival:true};
        }
      }
    }

    // v3.35: visible observer danger has priority over the optimized racing line.
    // The racer commits to a smooth lateral survival line first, then rejoins the racing line.
    const survivalWeave=naturalSurvivalWeave(p,s,now,nearby);
    if(survivalWeave){
      p.avoidPlanOffset=survivalWeave.targetOff;
      p.avoidPlanSpeedMul=survivalWeave.speedMul;
      p.avoidPlanRisk=12+survivalWeave.front*5;
      p.avoidPlanUntil=survivalWeave.until;
      p.avoidLastSide=Math.sign(survivalWeave.targetOff-p.desiredOffset)||p.avoidLastSide;
      p.avoidExitSide=p.avoidLastSide;
      p.avoidExitUntil=survivalWeave.until+360;
      p.match.avoids++;
      return {mode:"planned",targetOff:survivalWeave.targetOff,speedMul:survivalWeave.speedMul,
        risk:p.avoidPlanRisk,survivalWeave:true};
    }

    // v3.0 consecutive dodge combo: when several observers form a chain ahead,
    // commit to one flowing left-right escape sequence instead of recalculating
    // an unrelated direction for each observer.
    if(now<p.comboDodgeUntil){
      const elapsed=1-(p.comboDodgeUntil-now)/760;
      const wave=Math.sin(Math.max(0,Math.min(1,elapsed))*Math.PI*1.45);
      const comboOff=p.comboDodgeOffset + wave*p.comboDodgeSide*Math.max(1.2,widths[Math.min(p.seg,widths.length-1)]*.18);
      return {mode:"planned",targetOff:comboOff,speedMul:.985,risk:18,combo:true,minClear:2.0};
    }
    let chainedFront=0;
    for(const o of nearby){
      const dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy,lat=Math.abs(dx*s.nx+dy*s.ny);
      if(along>1.0&&along<13.5&&lat<widths[Math.min(p.seg,widths.length-1)]*.72) chainedFront++;
    }
    if(chainedFront>=3 && now>=p.comboDodgeUntil){
      const half=Math.max(2.2,widths[Math.min(p.seg,widths.length-1)]*.55);
      let leftRisk=0,rightRisk=0;
      for(const o of nearby){
        const dx=o.x-p.x,dy=o.y-p.y,along=dx*s.ux+dy*s.uy;
        if(along<=0||along>12) continue;
        const lat=dx*s.nx+dy*s.ny;
        if(lat<0) leftRisk++; else rightRisk++;
      }
      p.comboDodgeSide=leftRisk<=rightRisk?-1:1;
      p.comboDodgeOffset=p.comboDodgeSide*half*.72;
      p.comboDodgeUntil=now+620+Math.random()*140;
      p.avoidSideLockUntil=Math.max(p.avoidSideLockUntil,p.comboDodgeUntil);
      p.match.avoids++;
      return {mode:"planned",targetOff:p.comboDodgeOffset,speedMul:.985,risk:24,combo:true,minClear:1.8};
    }

    const predictionNorm=(p.stats.prediction-72)/27;
    const corridorBias=escapeCorridorBias(p,s,nearby);
    const clusterPlan=observerClusterPlan(p,s,nearby);
    const exitPlan=escapeGatePlan(p,s,nearby);
    if(exitPlan && clusterPlan.frontCount>=2 && exitPlan.minClear>.95){
      p.avoidPlanOffset=exitPlan.targetOff;
      p.avoidPlanSpeedMul=exitPlan.speedMul;
      p.avoidPlanRisk=exitPlan.score;
      p.avoidPlanUntil=now+260+Math.random()*130;
      p.avoidLastSide=Math.sign(exitPlan.targetOff-p.desiredOffset)||p.avoidLastSide;
      p.match.avoids++;
      return {mode:"planned",targetOff:exitPlan.targetOff,speedMul:exitPlan.speedMul,
        risk:exitPlan.score,minClear:exitPlan.minClear,escapeGate:true};
    }
    const corridorCommit=Math.min(.44,
      Math.abs(corridorBias)*(.14+predictionNorm*.11) +
      clusterPlan.confidence*(.16+predictionNorm*.10));

    // Fast pre-check. If nothing is remotely threatening, keep the racing line.
    let nearestSq=Infinity;
    let nearestFutureSq=Infinity;
    const px3=p.x+s.ux*p.speed*AVOID_PREDICT_SEC;
    const py3=p.y+s.uy*p.speed*AVOID_PREDICT_SEC;
    for(const o of nearby){
      const ndx=o.x-p.x, ndy=o.y-p.y;
      const d2=ndx*ndx+ndy*ndy;
      if(d2<nearestSq) nearestSq=d2;
      const ox=predictedObserverX(o,AVOID_PREDICT_SEC);
      const oy=predictedObserverY(o,AVOID_PREDICT_SEC);
      const fdx=ox-px3, fdy=oy-py3;
      const fd2=fdx*fdx+fdy*fdy;
      if(fd2<nearestFutureSq) nearestFutureSq=fd2;
    }
    const nearest=Math.sqrt(nearestSq);
    const nearestFuture=Math.sqrt(nearestFutureSq);
    if(nearestSq>240.25 && nearestFutureSq>144.0){
      p.avoidPlanUntil=0;
      p.avoidClearSince=p.avoidClearSince||now;
      // Once the obstacle field is clearly gone, release avoidance quickly.
      // The normal racing-line planner retakes control instead of lingering off-line.
      if(now-p.avoidClearSince>140){
        p.avoidExitUntil=0;
        p.avoidLastSide=0;
      }
      return null;
    }
    p.avoidClearSince=0;

    const si=Math.min(p.seg,segs.length-1);
    const evadeSkill=(p.stats.avoidance+p.stats.reaction+p.stats.prediction)/3;
    const reactionNorm=(p.stats.reaction-72)/27;
    const controlNorm=(p.stats.control-72)/27;
    const compactSkill=(reactionNorm+predictionNorm+controlNorm)/3;
    const evadeNorm=(evadeSkill-72)/27;
    const survivalWide=1+(p.survivalNorm||0)*.16;
    const half=Math.max(3.6,widths[si]*(0.675-compactSkill*0.070+evadeNorm*0.035)*p.drivingStyle.safety*survivalWide);

    // v2.60 GAP PASS: if two observers leave a calculably safe window,
    // thread the midpoint before falling back to a larger avoidance detour.
    const gapPlan=observerGapPassPlan(p,s,nearby);
    if(gapPlan && nearest>2.25){
      const gr=candidateAvoidanceRisk(p,s,gapPlan.targetOff,gapPlan.speedMul,nearby);
      const needed=.78+(p.survivalNorm||0)*.18;
      if(gr.minClear>needed){
        p.avoidPlanOffset=gapPlan.targetOff;
        p.avoidPlanSpeedMul=gapPlan.speedMul;
        p.avoidPlanRisk=gr.score;
        p.avoidPlanUntil=now+240+Math.random()*110;
        p.avoidLastSide=Math.sign(gapPlan.targetOff-p.desiredOffset)||p.avoidLastSide;
        p.match.avoids++;
        return {mode:"planned",targetOff:gapPlan.targetOff,speedMul:gapPlan.speedMul,risk:gr.score,gapPass:true};
      }
    }

    // v2.45 DIAGONAL SKIM DODGE:
    // When an observer is directly ahead, prefer a quick diagonal slip-by instead
    // of braking/stop-control. Both sides are risk-tested; avoidance remains safe.
    let frontThreat=null,frontAlong=Infinity,frontLat=0;
    for(const o of nearby){
      const dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy;
      const lat=dx*s.nx+dy*s.ny;
      if(along>0 && along<10.2 && Math.abs(lat)<3.4 && along<frontAlong){
        frontThreat=o;frontAlong=along;frontLat=lat;
      }
    }
    if(frontThreat && now>=p.skimDodgeCooldown){
      const skimChance=Math.min(.995,(.88+reactionNorm*.055+predictionNorm*.045+controlNorm*.025)*signatureOf(p).skim);
      if(Math.random()<skimChance){
        const sidePref=frontLat>=0?-1:1;
        const skimMag=half*(.58+compactSkill*.15);
        const candA=Math.max(-half*.98,Math.min(half*.98,p.desiredOffset+sidePref*skimMag));
        const candB=Math.max(-half*.98,Math.min(half*.98,p.desiredOffset-sidePref*skimMag*.88));
        const riskA=candidateAvoidanceRisk(p,s,candA,.97,nearby);
        const riskB=candidateAvoidanceRisk(p,s,candB,.95,nearby);
        const chosen=riskA.score<=riskB.score
          ? {targetOff:candA,speedMul:.99,risk:riskA}
          : {targetOff:candB,speedMul:.98,risk:riskB};
        if(chosen.risk.minClear>.80 || Math.min(riskA.score,riskB.score)<210){
          p.avoidPlanOffset=chosen.targetOff;
          p.avoidPlanSpeedMul=chosen.speedMul;
          p.avoidPlanRisk=chosen.risk.score;
          p.avoidLastSide=Math.sign(chosen.targetOff-p.desiredOffset)||sidePref;
          p.avoidExitSide=p.avoidLastSide;
          p.avoidExitUntil=now+430;
          p.avoidSideLockUntil=now+250;
          p.avoidPlanUntil=now+210+Math.random()*120;
          p.skimDodgeCooldown=now+360+Math.random()*340;
          p.match.avoids++;
          return {mode:"planned",targetOff:chosen.targetOff,speedMul:chosen.speedMul,risk:chosen.risk.score,skim:true};
        }
      }
      p.skimDodgeCooldown=now+180+Math.random()*220;
    }

    // Candidate lanes + speed choices. The planner chooses the safest path that
    // costs the least race time. Stop is evaluated only as an emergency option.
    const laneFracs=clusterPlan.density>.38
      ? [-1.10,-1.02,-.94,-.86,-.76,-.66,-.56,-.46,-.36,-.26,-.16,-.08,0,.08,.16,.26,.36,.46,.56,.66,.76,.86,.94,1.02,1.10]
      : [-1.08,-.98,-.88,-.78,-.68,-.58,-.48,-.38,-.28,-.18,-.09,0,.09,.18,.28,.38,.48,.58,.68,.78,.88,.98,1.08];
    const movingSpeeds=clusterPlan.emergency ? [1.045,1.01,.97,.91,.84] : [1.045,1.015,.98,.93];
    let best=null;

    for(const frac of laneFracs){
      const targetOff=frac*half;
      for(const sm of movingSpeeds){
        const r=candidateAvoidanceRisk(p,s,targetOff,sm,nearby);
        const rollout=rolloutActionRisk(p,s,targetOff,sm,nearby);
        const side=Math.sign(targetOff);
        const corridorBonus=(side!==0 && Math.sign(corridorBias)===side) ? corridorCommit*7.2 : 0;
        const clusterDistance=Math.abs(targetOff-clusterPlan.preferredOffset)/Math.max(1,half);
        const clusterBonus=(1-Math.min(1,clusterDistance))*clusterPlan.confidence*(clusterPlan.frontCount>=3?18.5:13.0);
        const centerPenalty=(clusterPlan.frontCount>=3 && Math.abs(frac)<.20)
          ? clusterPlan.density*7.5 : 0;
        const candidate={
          mode:"planned",
          targetOff,
          speedMul:sm,
          score:r.score*.22+rollout.score*.78-corridorBonus-clusterBonus+centerPenalty,
          minClear:Math.min(r.minClear,rollout.minClear)
        };
        if(!best || candidate.score<best.score) best=candidate;
      }
    }

    // v2.7 moving-avoidance only: the generic planner must never create an
    // unexplained full stop. Full stopping is reserved for the extremely rare
    // explicit stopcon or a real observer collision.
    const riskClearance=Math.max(.98,1.15-(p.tacticalRisk||0)*.22+(p.survivalNorm||0)*.24);
    if(!best){
      best={mode:"planned",targetOff:p.desiredOffset,speedMul:.82,score:999,minClear:0};
    }
    if(best.speedMul<=0) best.speedMul=.72;

    // No meaningful danger: don't disturb the optimal racing line.
    if(best && best.minClear>8.8 && best.score<8.0 && nearest>10.5){
      p.avoidPlanUntil=0;
      return null;
    }

    // Persist 320–560 ms. Very dangerous situations re-plan sooner.
    const emergency=clusterPlan.emergency || best.minClear<2.7 || nearest<5.0;
    const chosenSide=Math.sign(best.targetOff);
    if(!emergency && chosenSide!==0 && p.avoidLastSide!==0 &&
       chosenSide!==p.avoidLastSide && now<p.avoidSideLockUntil){
      best.targetOff=Math.abs(best.targetOff)*p.avoidLastSide;
      best.score+=1.8;
    }
    if(Math.sign(best.targetOff)!==0){
      p.avoidLastSide=Math.sign(best.targetOff);
      p.avoidExitSide=p.avoidLastSide;
      p.avoidExitUntil=now+(emergency?420:720);
      const stable=(p.stats.stability-72)/27;
      p.avoidSideLockUntil=now+(emergency?190:500+stable*170);
    }

    const react=(p.stats.reaction+p.stats.prediction)/2;
    const smooth=(p.stats.control+p.stats.stability)/2;
    const baseHold=500+(smooth-85)*5;
    if(Math.abs(corridorBias)>.12 || clusterPlan.confidence>.16){
      const roadHalf=Math.max(1.8,widths[Math.min(p.seg,widths.length-1)]*.55);
      const legacyTarget=corridorBias*roadHalf;
      const clusterTarget=Math.max(-roadHalf,Math.min(roadHalf,clusterPlan.preferredOffset));
      const clusterBlend=Math.min(.52,.18+clusterPlan.confidence*.34);
      const legacyBlend=Math.min(.18,Math.abs(corridorBias)*.14);
      best.targetOff=best.targetOff*(1-clusterBlend-legacyBlend)
        +clusterTarget*clusterBlend+legacyTarget*legacyBlend;
    }
    p.avoidPlanOffset=best.targetOff;
    p.avoidPlanSpeedMul=best.speedMul;
    p.avoidPlanRisk=best.score;
    p.match.avoids++;
    const clusterHold=clusterPlan.confidence>.30 ? 120+clusterPlan.confidence*170 : 0;
    p.avoidPlanUntil=now+(emergency
      ? Math.max(185,265-(react-85)*4)+Math.random()*65
      : Math.max(350,baseHold+clusterHold)+Math.random()*130);
    return best;
  }



  function racerPressureLevel(p){
    if(!p || p.done) return 0;
    const my=currentProgress(p);
    let nearest=999;
    for(let i=0;i<players.length;i++){
      const q=players[i];
      if(q===p || q.done) continue;
      const gap=Math.abs(currentProgress(q)-my);
      if(gap<nearest) nearest=gap;
    }
    return Math.max(0,Math.min(1,(5.0-nearest)/4.6));
  }

  function pressureLineAdjustment(p,si,now,baseOff){
    const pressureLevel=racerPressureLevel(p);
    p.livePressure=pressureLevel;
    if(pressureLevel<=.02) return baseOff;
    const pressureSkill=(p.stats.pressure-72)/27;
    const focus=(p.stats.focus-72)/27;
    const consistency=(p.stats.consistency-72)/27;
    const aggression=(p.stats.aggression-72)/27;
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.54);
    const composure=Math.max(0,Math.min(1,pressureSkill*.48+focus*.32+consistency*.20));
    const wobble=pressureLevel*(1-composure)*half*.055;
    let off=baseOff+Math.sin(now*.0063+p.index*1.71)*wobble;
    const side=cornerInsideSide(si)||Math.sign(futureInsideBias(si));
    if(side && composure>.60 && aggression>.55){
      const attack=pressureLevel*(.025+.035*aggression);
      off=off*(1-attack)+(side*half*.96)*attack;
    }
    return off;
  }

  function liveRaceSituation(p){
    const my=currentProgress(p);
    let rank=1;
    let nearestAheadGap=999;
    for(let i=0;i<players.length;i++){
      const q=players[i];
      if(q===p) continue;
      const qp=currentProgress(q);
      if(qp>my) rank++;
      const gap=qp-my;
      if(gap>0 && gap<nearestAheadGap) nearestAheadGap=gap;
    }
    let nearestBehindGap=999;
    for(let i=0;i<players.length;i++){
      const q=players[i];
      if(q===p || q.done) continue;
      const gap=my-currentProgress(q);
      if(gap>0 && gap<nearestBehindGap) nearestBehindGap=gap;
    }
    const ratio=Math.max(0,Math.min(1,my/routeLength));
    const state=rank===1
      ? (nearestBehindGap<4.8 ? "LEADER_DEFEND" : "LEADER_CONTROL")
      : (ratio>.78 ? "CLUTCH_CHASE" : (nearestAheadGap<5.2 ? "CHASE" : "RACE"));
    return {rank,progress:my,remaining:Math.max(0,routeLength-my),nearestAheadGap,nearestBehindGap,ratio,state};
  }

  function tacticalRiskLevel(p,now){
    if(now<p.tacticalRiskUntil) return p.tacticalRisk;
    if(now<p.tacticalRiskCooldown) return p.tacticalRisk;

    const rs=liveRaceSituation(p);
    const progressRatio=Math.max(0,Math.min(1,rs.progress/routeLength));
    const aggression=(p.stats.aggression-72)/27;
    const pressure=(p.stats.pressure-72)/27;
    const riskControl=(p.stats.riskControl-72)/27;
    const prediction=(p.stats.prediction-72)/27;

    // No rubber-band speed boost: trailing racers only accept slightly riskier routes.
    const rankNeed=Math.max(0,(rs.rank-3)/5);
    const lateNeed=Math.max(0,(progressRatio-.58)/.42);
    const passChance=rs.nearestAheadGap<5.0 ? .12 : 0;
    let risk=.04 + aggression*.10 + pressure*.06 + rankNeed*(.14+.18*lateNeed) + passChance;
    // v4.46: Risk Control must REDUCE reckless route acceptance, not increase it.
    // Prediction can support a calculated attack because the racer reads moving gaps earlier.
    risk += prediction*.025 - riskControl*.060;
    risk += (p.raceForm-1)*(.30+pressure*.08);

    // Situation-aware race management. This changes route risk only; there is no rubber-band speed boost.
    if(rs.rank===1){
      // Leaders protect a result, especially late. High Risk Control makes this effect stronger.
      risk-=.105 + Math.max(0,riskControl)*(.045+.055*progressRatio);
      if(progressRatio>.72) risk-=.025+Math.max(0,pressure)*.018;
    }else if(rs.rank===2){
      // P2 attacks a reachable leader late, but composed racers do not panic if the gap is large.
      if(progressRatio>.68 && rs.nearestAheadGap<6.2)
        risk+=.035 + Math.max(0,aggression)*.030 + Math.max(0,pressure)*.018;
    }else if(rs.rank>=3){
      const urgency=Math.max(0,(progressRatio-.55)/.45);
      risk+=urgency*(.025+Math.max(0,aggression)*.045+Math.max(0,pressure)*.025);
    }
    if(progressRatio>.88 && rs.rank>=3) risk+=.030+Math.max(0,pressure)*.022;
    risk=Math.max(0,Math.min(.52,risk));

    p.tacticalRisk=risk;
    p.tacticalRiskUntil=now+520+Math.random()*380;
    p.tacticalRiskCooldown=now+420+Math.random()*300;
    return risk;
  }

  function tacticalSituationOffset(p,si,now,baseOff){
    const risk=tacticalRiskLevel(p,now);
    if(risk<.08) return baseOff;

    if(now<p.situationDecisionUntil){
      return Math.abs(p.situationDecisionOffset)>.001
        ? baseOff*.34+p.situationDecisionOffset*.66
        : baseOff;
    }

    const rs=liveRaceSituation(p);
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.575);
    const inside=cornerInsideSide(si);
    const turn=cornerIntensity(si);
    const nearby=playerPerceivedObservers(p,12.5);
    let chosen=0;

    // v4.46 leader protection: when closely chased, prefer the already-stable racing line
    // instead of inventing a risky tactical lane change. Avoidance still has final authority.
    if(rs.state==="LEADER_DEFEND" && nearby.length>0){
      p.situationDecisionOffset=0;
      p.situationDecisionUntil=now+360+Math.max(0,(p.stats.riskControl-72)/27)*180;
      return baseOff;
    }

    if(nearby.length<=2 && rs.nearestAheadGap<4.9){
      let side=inside;
      if(side===0) side=(p.index%2?1:-1);
      const commit=Math.min(.96,.46+risk*.82+((p.stats.control-72)/27)*.08);
      if(Math.random()<Math.min(.26,risk*.16)) chosen=side*half*commit;
    }

    if(!chosen && rs.rank>=4 && rs.progress>routeLength*.62 && inside!==0 && turn>.045 && nearby.length===0){
      if(Math.random()<Math.min(.18,risk*.11)){
        const commit=Math.min(.995,.84+risk*.28);
        chosen=inside*half*commit;
      }
    }

    p.situationDecisionOffset=chosen;
    p.situationDecisionUntil=now+280+Math.random()*260;
    return chosen ? baseOff*.34+chosen*.66 : baseOff;
  }


  function tacticalVariantOffset(p,si,now,baseOff){
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.57);

    if(now<p.variantUntil && p.variantMode){
      return Math.max(-half*.998,Math.min(half*.998,
        baseOff*(1-p.variantStrength)+p.variantSide*half*p.variantStrength));
    }

    if(p.variantMode && now>=p.variantUntil){
      p.variantMode=0;
      p.variantSide=0;
      p.variantStrength=0;
    }

    if(now<p.variantCooldown) return baseOff;

    // Never gamble into immediate observer danger.
    const nearby=playerPerceivedObservers(p,11.5);
    if(nearby.length>0){
      p.variantCooldown=now+1600+Math.random()*2200;
      return baseOff;
    }

    const inside=cornerInsideSide(si);
    const power=cornerIntensity(si);
    if(inside===0 || power<0.045){
      p.variantCooldown=now+1800+Math.random()*2600;
      return baseOff;
    }

    const aggression=(p.stats.aggression-72)/27;
    const insideSkill=(p.stats.insideLine-72)/27;
    const control=(p.stats.control-72)/27;
    const pressure=(p.stats.pressure-72)/27;

    // Very low probability tactical gamble: attack an extreme apex for a pass.
    const chance=.030 + aggression*.018 + insideSkill*.022 + pressure*.010;
    if(Math.random()<chance){
      p.variantMode=1;
      p.variantSide=inside;
      const identity=identityOf(p);
      p.variantStrength=Math.min(.995,(.88+insideSkill*.07+control*.025)*(identity.apex||1));
      p.variantUntil=now+520+Math.random()*620;
      p.variantCooldown=now+5200+Math.random()*6200;
      return baseOff*(1-p.variantStrength)+inside*half*p.variantStrength;
    }

    p.variantCooldown=now+2200+Math.random()*3000;
    return baseOff;
  }


  // v2.13: dedicated overtake/comeback planner.
  // It never gives a trailing racer extra base speed. It only changes line choice,
  // timing, and risk according to the next corner and observer layout.
  function racerLateralOffsetOnSeg(q,si){
    const s=segs[Math.min(si,segs.length-1)];
    return (q.x-s.a[0])*s.nx+(q.y-s.a[1])*s.ny;
  }

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

  function chaseLine75(p,si,baseOff){
    const rs=liveRaceSituation(p);
    if(rs.rank<=1 || rs.nearestAheadGap>8.5) return baseOff;
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const fast=raceLine79(p,idx,baseOff,false);
    // Never copy a slower opponent's lane. A chaser follows the map's fast line.
    const urgency=Math.max(0,Math.min(1,(8.5-rs.nearestAheadGap)/8.5));
    const authority=.72+urgency*.20;
    return baseOff*(1-authority)+fast*authority;
  }

  
  function multiCarTraffic66(p,si,myProg){
    const out=[];
    for(let i=0;i<players.length;i++){
      const q=players[i];
      if(q===p || q.done || q.dead) continue;
      const gap=currentProgress(q)-myProg;
      if(gap>-2.4 && gap<12.8){
        out.push({q,gap,off:racerLateralOffsetOnSeg(q,si)});
      }
    }
    return out;
  }

  function multiCarCandidateScore66(p,si,off,traffic,soloLine){
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.57);
    // Never abandon the fast line without a traffic benefit.
    let score=Math.abs(off-soloLine)*.135; // v4.69: stronger fast-line cost

    for(const t of traffic){
      const dg=Math.abs(t.gap);
      const lat=Math.abs(off-t.off);
      if(t.gap>=-.45){
        const longW=Math.max(0,1-Math.max(0,t.gap)/9.5);
        const laneW=Math.max(0,1-lat/1.62);
        score+=laneW*longW*4.25;
        if(Math.abs(t.gap)<1.45 && lat<1.05) score+=(1.45-Math.abs(t.gap))*.95+1.0;
      } else if(dg<1.5 && lat<1.0){
        // Side-by-side racer slightly behind: do not cut across their held corridor.
        score+=(1.5-dg)*.82;
      }
    }

    // Preserve 4.64 corner quality: among similarly open lanes, prefer the lane
    // that hands the car to the next 2-3 corners cleanly.
    let bestFutureSide=0,bestFuturePower=0;
    for(let k=0;k<=3;k++){
      const sj=Math.min(segs.length-1,si+k);
      const c=cornerIntensity(sj);
      const side=cornerInsideSide(sj);
      const weighted=c*(1-k*.15);
      if(side && weighted>bestFuturePower){
        bestFuturePower=weighted;
        bestFutureSide=side;
      }
    }
    if(bestFutureSide && bestFuturePower>.025){
      const useful=bestFutureSide*half*Math.min(.88,.60+bestFuturePower*1.6);
      score+=Math.abs(off-useful)*Math.min(.13,.035+bestFuturePower*.38);
    }
    return score;
  }

  // v4.66 MULTI-CAR RACING LINE 2.0
  // Solo/leader: keep the globally optimal 4.64 line.
  // Chaser/pack: only leave it when another racer really occupies the useful corridor.
  // Side-by-side: hold distinct corridors briefly instead of repeatedly crossing.
  // Racers are still non-solid; there is no push, contact slowdown or rubber-banding.
  function multiCarRacingLine66(p,si,now,soloLine){
    if(now<p.multiCarLineUntil && p.multiCarLineMode!=="solo"){
      return {off:p.multiCarLineOffset,mode:p.multiCarLineMode,authority:.76};
    }

    const myProg=currentProgress(p);
    const traffic=multiCarTraffic66(p,si,myProg);
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.57);
    if(!traffic.length){
      p.multiCarLineMode="solo";
      p.multiCarLineOffset=soloLine;
      p.multiCarLineUntil=now+180;
      return {off:soloLine,mode:"solo",authority:0};
    }

    const ahead=traffic.filter(t=>t.gap>.10);
    const sideBySide=traffic.filter(t=>Math.abs(t.gap)<=1.35);
    const optimalBlocked=ahead.some(t=>t.gap<6.8 && Math.abs(t.off-soloLine)<1.45);

    // Leading/open-air cars must not weave simply because somebody exists behind.
    if(!optimalBlocked && sideBySide.length===0){
      p.multiCarLineMode="leader";
      p.multiCarLineOffset=soloLine;
      p.multiCarLineUntil=now+200;
      return {off:soloLine,mode:"leader",authority:0};
    }

    const candidates=[
      Math.max(-half*.97,Math.min(half*.97,soloLine)),
      -half*.56, half*.56,
      -half*.38, half*.38,
      -half*.20, half*.20
    ];
    let bestOff=soloLine;
    let bestScore=multiCarCandidateScore66(p,si,soloLine,traffic,soloLine);
    const baseScore=bestScore;
    for(const off of candidates){
      const score=multiCarCandidateScore66(p,si,off,traffic,soloLine);
      if(score<bestScore){bestScore=score;bestOff=off;}
    }

    // No deliberately slow personality routes: if leaving the solo line does not
    // materially solve traffic, remain on the fast line.
    const trafficGain=baseScore-bestScore;
    if(trafficGain<.24 && !sideBySide.length){
      p.multiCarLineMode="leader";
      p.multiCarLineOffset=soloLine;
      p.multiCarLineUntil=now+190;
      return {off:soloLine,mode:"leader",authority:0};
    }

    let mode=sideBySide.length?"side-by-side":"pack";
    if(optimalBlocked && !sideBySide.length) mode="chaser";

    // If parallel with somebody, prefer staying on the side already occupied by p
    // unless that lane is clearly worse. This stops left-right lane swapping.
    if(sideBySide.length){
      const myOff=racerLateralOffsetOnSeg(p,si);
      const sameSideCandidates=candidates.filter(x=>Math.sign(x||myOff||1)===Math.sign(myOff||1));
      let holdOff=bestOff,holdScore=bestScore;
      for(const off of sameSideCandidates){
        const score=multiCarCandidateScore66(p,si,off,traffic,soloLine);
        if(score<=holdScore+.34){holdScore=score;holdOff=off;}
      }
      bestOff=holdOff;
    }

    const read=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
    const control=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const authority=Math.min(.90,.66+read*.11+control*.08+(sideBySide.length?.05:0));

    p.multiCarLineMode=mode;
    p.multiCarLineOffset=bestOff;
    p.multiCarLineUntil=now+(sideBySide.length?560:300)+Math.random()*150;
    return {off:bestOff,mode,authority};
  }

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

  function cornerPhaseTarget(p,si,half){
    const seq=racingCornerSequence(si);
    const s=segs[si];
    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
    const phase=s.L>0?along/s.L:1;
    const insideSkill=(p.stats.insideLine-72)/27;
    const cornerSkill=(p.stats.cornering-72)/27;
    const routeRead=(p.stats.routeReading-72)/27;
    const precision=Math.max(0,Math.min(1,(insideSkill+cornerSkill+routeRead)/3));
    const confidence=Math.max(0,Math.min(1,p.cleanConfidence||0));

    // v4.14 shortest-line racing: do NOT use the classic outside-entry -> apex pattern.
    // Racers progressively attach to the inside before the bend, skim the inside
    // through it, then release smoothly. This is derived only from route curvature;
    // there are no hand-coded corner coordinates.
    if(seq.currentSide===0 && seq.nextSide!==0){
      const approach=seq.nextSide*half*(.68+.28*precision);
      return {target:approach,weight:.54+.24*routeRead,seq};
    }

    if(seq.currentSide!==0){
      if(phase<.24){
        const earlyInside=seq.currentSide*half*(.71+.26*precision);
        return {target:earlyInside,weight:.58+.22*cornerSkill,seq};
      }
      if(phase<.76){
        const apex=seq.currentSide*half*Math.min(.998,.935+.058*precision+.012*confidence);
        return {target:apex,weight:.72+.22*precision,seq};
      }
      if(seq.nextSide!==0){
        const release=seq.nextSide*half*(.62+.31*routeRead);
        return {target:release,weight:.50+.24*routeRead,seq};
      }
      const exit=seq.currentSide*half*(.58+.22*precision);
      return {target:exit,weight:.42+.18*precision,seq};
    }
    return {target:0,weight:0,seq};
  }


  function preCornerPositionTarget(p,si,now,baseOff){
    const s=segs[Math.min(si,segs.length-1)];
    let nextSide=0,nextIndex=-1;
    for(let j=si+1;j<Math.min(segs.length,si+9);j++){
      const side=cornerInsideSide(j);
      if(side!==0){nextSide=side;nextIndex=j;break;}
    }
    if(nextIndex<0 || nextSide===0) return baseOff;
    const distanceSeg=nextIndex-si;
    if(distanceSeg>5) return baseOff;
    const read=(p.stats.routeReading-72)/27;
    const corner=(p.stats.cornering-72)/27;
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.56);
    // v4.14: shortest-path preparation. Move toward the UPCOMING INSIDE early
    // instead of swinging to the outside and making a large right-angle arc.
    const inside=(p.stats.insideLine-72)/27;
    const setup=nextSide*half*(.60+.30*read+.10*inside);
    const weight=Math.max(.22,Math.min(.76,(6-distanceSeg)*.095+.17*read+.10*corner+.08*inside));
    if(now<p.preCornerUntil) return baseOff*.42+p.preCornerOffset*.58;
    p.preCornerOffset=setup;
    p.preCornerUntil=now+380+read*180;
    return baseOff*(1-weight)+setup*weight;
  }

  function linkedCornerTarget(p,si,baseOff){
    const seq=racingCornerSequence(si);
    if(seq.currentSide===0 || seq.nextSide===0 || seq.nextIndex<0) return baseOff;
    const s=segs[Math.min(si,segs.length-1)];
    const along=Math.max(0,Math.min(s.L,(p.x-s.a[0])*s.ux+(p.y-s.a[1])*s.uy));
    const phase=s.L?along/s.L:1;
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.57);
    const read=(p.stats.routeReading-72)/27;
    const corner=(p.stats.cornering-72)/27;
    const inside=(p.stats.insideLine-72)/27;
    const skill=Math.max(0,Math.min(1,(read+corner+inside)/3));
    if(seq.currentSide===seq.nextSide){
      const linked=seq.currentSide*half*Math.min(.997,.91+skill*.075);
      const w=phase>.45 ? (.34+.28*skill) : (.16+.15*skill);
      return baseOff*(1-w)+linked*w;
    }
    if(phase>.54){
      const prep=seq.nextSide*half*(.62+.30*skill);
      const w=Math.min(.62,.24+(phase-.54)*.72+.18*skill);
      return baseOff*(1-w)+prep*w;
    }
    return baseOff;
  }

  // v4.49 CORNER / INSIDE-LINE FINALIZER:
  // Build one continuous entry -> apex -> exit decision from route geometry.
  // High Cornering / Inside Line / Route Reading racers commit earlier and closer
  // to the legal inside edge. The next corner is considered before the current
  // corner ends, so S-bends connect without a centre-line snap. Observer avoidance
  // is applied later and always retains final authority.
  function precisionCornerTarget(p,si,now,baseOff){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[idx];
    const half=Math.max(1.8,widths[Math.min(idx,widths.length-1)]*.565);
    const insideN=Math.max(0,Math.min(1,(p.stats.insideLine-72)/27));
    const cornerN=Math.max(0,Math.min(1,(p.stats.cornering-72)/27));
    const readN=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
    const controlN=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const skill=Math.max(0,Math.min(1,insideN*.34+cornerN*.31+readN*.23+controlN*.12));
    const seq=racingCornerSequence(idx);
    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
    const phase=s.L>0?along/s.L:1;

    // If the current segment is straight, prepare for the first meaningful turn.
    if(seq.currentSide===0 && seq.nextSide!==0){
      const gap=Math.max(1,(seq.nextIndex-idx));
      const proximity=Math.max(0,1-Math.min(1,(gap-1)/5));
      const commit=.58+.26*skill+.10*proximity;
      const target=seq.nextSide*half*Math.min(.965,commit);
      const w=.28+.28*readN+.14*cornerN+.12*proximity;
      return baseOff*(1-Math.min(.76,w))+target*Math.min(.76,w);
    }

    if(seq.currentSide===0) return baseOff;

    // Through the bend, progressively tighten to the apex. Good racers reach it
    // earlier, hold it more accurately, then release toward the next optimal line.
    let target=baseOff, weight=0;
    if(phase<.22){
      const entry=.70+.21*skill;
      target=seq.currentSide*half*Math.min(.955,entry);
      weight=.42+.28*cornerN+.12*readN;
    }else if(phase<.72){
      const apex=.925+.067*skill+(identityOf(p).apex-1)*.045;
      target=seq.currentSide*half*Math.min(.997,Math.max(.86,apex));
      weight=.64+.25*skill;
    }else if(seq.nextSide!==0){
      if(seq.nextSide===seq.currentSide){
        // Same-direction linked corners: stay attached to the inside rather than
        // unnecessarily opening the steering between bends.
        target=seq.currentSide*half*Math.min(.995,.89+.09*skill);
        weight=.52+.27*readN;
      }else{
        // Opposite-direction linked corners: cross the road smoothly only as much
        // as necessary to set up the following apex.
        const release=(phase-.72)/.28;
        const nextCommit=.54+.34*readN+.08*cornerN;
        const next=seq.nextSide*half*Math.min(.93,nextCommit);
        const current=seq.currentSide*half*(.64+.20*skill);
        target=current*(1-release)+next*release;
        weight=.46+.28*readN+.10*controlN;
      }
    }else{
      const exit=.54+.22*cornerN+.10*controlN;
      target=seq.currentSide*half*Math.min(.88,exit);
      weight=.36+.22*cornerN;
    }

    // Nearby observers do not disable corner skill, but they reduce racing-line
    // stubbornness so the later avoidance planner can take over cleanly.
    const obs=playerPerceivedObservers(p,10.5).length;
    if(obs>0) weight*=obs>=3?.48:.68;
    weight=Math.max(0,Math.min(.91,weight));
    return baseOff*(1-weight)+target*weight;
  }

  function creativeRouteAdjustment(p,si,now,baseOff){
    const progress=Math.max(0,Math.min(1,currentProgress(p)/routeLength));
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.54);
    const danger=playerPerceivedObservers(p,18).length, lp=p.linePersonality||0;
    // v4.68: on clear road, creativity means execution style, not a slower/wider route.
    if(danger===0) return baseOff;
    // Dense fields temporarily raise the creative-route allowance and reduce
    // the trigger threshold. Normal sections remain close to the v2.41 70/30 mix.
    const denseBoost=danger>=8?.16:danger>=5?.11:danger>=3?.055:0;
    const targetCreative=progress*Math.min(.68,p.creativeRouteBudget+denseBoost);
    const triggerSlack=danger>=5?.040:.018;
    if(now>=p.creativeModeUntil && now>=p.creativeCooldown && p.creativeRouteUsed+triggerSlack<targetCreative){
      const roll=Math.random();
      if(danger>=8) p.creativeMode=roll<.28?1:roll<.54?2:roll<.76?3:roll<.88?4:5;
      else if(danger>=5) p.creativeMode=roll<.22?1:roll<.48?2:roll<.72?3:roll<.85?4:5;
      else if(lp>.45) p.creativeMode=roll<.52?1:roll<.73?5:roll<.90?3:2;
      else if(lp<-.45) p.creativeMode=roll<.55?2:roll<.78?4:roll<.92?3:5;
      else p.creativeMode=roll<.25?1:roll<.50?2:roll<.72?3:roll<.84?4:5;
      p.creativeSide=Math.random()<.5?-1:1;
      const dense=danger>=5;
      p.creativeModeUntil=now+(dense?760:900)+Math.random()*(dense?1400:1700);
      p.creativeCooldown=now+(dense?650:1150)+Math.random()*(dense?1000:1550);
    }
    if(now<p.creativeModeUntil){
      p.creativeRouteUsed=Math.min(.55,p.creativeRouteUsed+(danger>=5?.00265:.00215));
      const inside=cornerInsideSide(si);
      if(p.creativeMode===1){
        // WALL APEX: on a real corner, hug the legal road edge as tightly as possible.
        // This is route choice only; observer avoidance can still override downstream.
        return inside ? inside*half*.999 : baseOff*.48+p.creativeSide*half*.30;
      }
      if(p.creativeMode===2) return (inside?-inside:p.creativeSide)*half*(danger>=8?.96:danger>=5?.92:.72);
      if(p.creativeMode===3){
        const amp=half*(danger>=8?.70:danger>=5?.64:.38);
        return Math.max(-half*.90,Math.min(half*.90,baseOff+Math.sin(now*.010+p.creativePhase)*amp));
      }
      if(p.creativeMode===4){
        // v2.51: old creative stop is replaced by a moving escape.
        if(danger>=3 && p.controlMode==="normal" && now>=p.controlCooldown){
          beginControl(p,Math.random()<.55?"diagonal":"zigzag",now,240+Math.random()*190,true,-1);
          p.controlCooldown=now+1200+Math.random()*1100;
        }
        return baseOff*.88;
      }
      if(p.creativeMode===5){
        const phase=Math.max(0,Math.min(1,1-(p.creativeModeUntil-now)/1500));
        const side=inside||p.creativeSide;
        return side*half*(phase<.48?-.50:.72);
      }
    }
    return baseOff;
  }

  function plannedRacingOffset(p,si,now){
    // Re-plan only a few times per second. This prevents rapid left/right
    // oscillation when racers overlap while still reacting early to corners.
    if(now < p.linePlanUntil) return p.linePlanOffset;

    const s=segs[si];
    const lineSkill=(p.stats.cornering+p.stats.insideLine+p.stats.routeReading)/3;
    const lineNorm=(lineSkill-72)/27;
    const half=Math.max(1.8,widths[si]*(1.015+lineNorm*0.050));

    // v31: when the local road is genuinely clear of observers, commit to a
    // near-wall Kart-style apex instead of wasting space in the middle.
    const cornerSide=cornerInsideSide(si);
    const cornerPower=cornerIntensity(si);
    const localObs=playerPerceivedObservers(p,18.0);
    if(localObs.length===0 && cornerSide!==0 && cornerPower>0.055){
      // v2.60: even on a clear road, use a true outside-entry/apex/exit sequence.
      const phasePlan=cornerPhaseTarget(p,si,half);
      const lp=p.linePersonality||0;
      const skill=(p.stats.insideLine+p.stats.cornering+p.stats.routeReading)/3;
      const skillN=(skill-72)/27;
      const insideN=Math.max(0,Math.min(1,(p.stats.insideLine-72)/27));
      const apexCommit=Math.max(.965,Math.min(1.035,.995+lp*.026+skillN*.020+insideN*.022+(p.cleanConfidence||0)*.012));
      let archetypeMul=1.0;
      const arch=p.routeArchetype||"adaptive";
      if(arch==="extremeInside") archetypeMul=1.075;
      else if(arch==="inside") archetypeMul=1.025;
      else if(arch==="wideCut") archetypeMul=.72;
      else if(arch==="variant") archetypeMul=.84+Math.sin(si*.71+(p.routeBandPhase||0))*.16;
      const apex=cornerSide*half*apexCommit*archetypeMul;
      const phaseBlend=Math.max(.30,Math.min(.82,phasePlan.weight+.14));
      p.linePlanOffset=apex*(1-phaseBlend)+phasePlan.target*phaseBlend;
      p.linePlanUntil=now+280+Math.random()*90;
      return p.linePlanOffset;
    }

    const candidates=[-0.999,-0.91,-0.76,-0.58,-0.34,0,0.34,0.58,0.76,0.91,0.999];
    const phasePlan=cornerPhaseTarget(p,si,half);
    let bestOff=0;
    let bestScore=Infinity;

    const routeRead=(p.stats.routeReading-72)/27;
    const maxAhead=Math.min(segs.length-1,si+5+Math.round(routeRead*3));
    for(const c of candidates){
      const off=c*half;
      let px=p.x, py=p.y;
      let score=0;

      // Cost of getting from the current position onto this candidate line.
      const entryX=s.b[0]+s.nx*off;
      const entryY=s.b[1]+s.ny*off;
      const edx=entryX-px, edy=entryY-py; score += Math.sqrt(edx*edx+edy*edy);
      px=entryX; py=entryY;

      // Look through several future segments and compare total path length.
      // Candidate offsets progressively prepare for the next apex.
      for(let j=si+1;j<=maxAhead;j++){
        const seg=segs[j];
        const prev=segs[Math.max(si,j-1)];
        const next=segs[Math.min(segs.length-1,j+1)];
        const turn=prev.ux*next.uy-prev.uy*next.ux;
        const h=Math.max(1.6,widths[j]*0.635);

        let futureOff=off*(0.56-routeRead*.09);
        if(Math.abs(turn)>0.025){
          const inside=(turn>0 ? 1 : -1);
          const apexCommit=0.91+routeRead*.085+((p.stats.insideLine-72)/27)*.105;
          const nextApex=inside*h*Math.min(.997,apexCommit);
          const prep=0.66+routeRead*.24;
          futureOff=futureOff*(1-prep)+nextApex*prep;

          // Read one more corner: if the following corner turns the other way,
          // reward an exit that naturally sets up the next entry.
          if(j<maxAhead){
            const nn=segs[Math.min(segs.length-1,j+2)];
            const nextTurn=next.ux*nn.uy-next.uy*nn.ux;
            if(Math.abs(nextTurn)>.025){
              const nextInside=nextTurn>0?1:-1;
              const transition=-nextInside*h*(.22+routeRead*.18);
              futureOff=futureOff*.78+transition*.22;
            }
          }
        }

        const wx=seg.b[0]+seg.nx*futureOff;
        const wy=seg.b[1]+seg.ny*futureOff;
        score += Math.hypot(wx-px,wy-py);
        px=wx; py=wy;
      }

      // v4.04: no forced opening wall route. Start lanes remain genuinely diverse;
      // stats/personality decide whether to use upper, middle, or lower legal bands.

      // v2.27 corner phase: reward a realistic outside-entry -> apex -> exit setup.
      if(phasePlan.weight>0){
        const phaseDist=Math.abs(off-phasePlan.target)/Math.max(1,half);
        score += phaseDist*(.44+phasePlan.weight*.72);
      }

      // v2.34 persistent route personality:
      // inside specialists prefer the corner's inside candidate; safety racers pay
      // extra cost near either edge and therefore keep a visibly wider/smoother route.
      const lp=p.linePersonality||0;
      if(cornerSide!==0 && cornerPower>.035){
        const insideCandidate=c*cornerSide;
        if(lp>0) score-=Math.max(0,insideCandidate)*lp*.46;
        else score+=Math.abs(c)*(-lp)*.52;
      }else if(lp<0){
        score+=Math.abs(c)*(-lp)*.18;
      }

      // v4.02 PERSONAL ROUTE DIVERSITY:
      // Do not make all racers collapse onto the same mathematical optimum.
      // Route-reading controls how strongly a racer trusts the optimal line;
      // individual stats/style create a persistent legal lane preference.
      // On corners the preference blends with the real inside/outside phase rather
      // than fighting it, and any observer avoidance later overrides this planner.
      const readTrust=(p.stats.routeReading-72)/27;
      const controlTrust=((p.stats.control+p.stats.consistency)/2-72)/27;
      const safetyBias=((p.stats.riskControl+p.stats.stability)/2-72)/27;
      const routeVar=Math.max(.26,Math.min(.82,.66-readTrust*.15-controlTrust*.04+safetyBias*.05));
      let personalTarget=(p.routeBand||0);
      const archetype=p.routeArchetype||"adaptive", archetypeStrength=p.routeArchetypeStrength||.8;
      if(cornerSide!==0 && cornerPower>.035){
        const insideTalent=(p.stats.insideLine-72)/27;
        const cornerTalent=(p.stats.cornering-72)/27;
        let archetypeTarget=cornerSide*(.72+insideTalent*.25);
        if(archetype==="extremeInside") archetypeTarget=cornerSide*(1.08+insideTalent*.08);
        else if(archetype==="inside") archetypeTarget=cornerSide*(.92+insideTalent*.08);
        else if(archetype==="wideCut") archetypeTarget=-cornerSide*(.34+Math.max(0,safetyBias)*.18);
        else if(archetype==="variant") archetypeTarget=cornerSide*(.42+Math.sin(si*.73+(p.routeBandPhase||0))*.42);
        const cornerBlend=Math.max(.30,Math.min(.88,.42+insideTalent*.18+cornerTalent*.12+archetypeStrength*.12));
        personalTarget=personalTarget*(1-cornerBlend)+archetypeTarget*cornerBlend;
      }else{
        const wave=archetype==="variant"?.42:archetype==="wideCut"?.30:.24;
        personalTarget+=Math.sin((si*.38)+(p.routeBandPhase||0))*wave*archetypeStrength;
        if(archetype==="extremeInside") personalTarget*=1.12;
      }
      personalTarget=Math.max(-1.16,Math.min(1.16,personalTarget));
      const personalDist=Math.abs(c-personalTarget);
      score += personalDist*routeVar*(1.45+archetypeStrength*.45);

      // v4.06 DEATH-EDGE AWARENESS: no wall exists. Two outer rows are survivable,
      // but racers understand the third row is lethal. Extreme inside specialists can
      // exploit the survivable margin while normal lines keep a safer buffer.
      const legalRatio=Math.abs(off)/Math.max(1,half);
      const edgeRisk=currentMap770().edgePassThrough786?0:Math.max(0,legalRatio-.91);
      const insideN=(p.stats.insideLine-72)/27;
      const controlN=(p.stats.control-72)/27;
      score += edgeRisk*edgeRisk*(.42-insideN*.16-controlN*.10);

      // Avoid wall scraping while still allowing near-apex lines.
      // Skilled racers pay a smaller penalty and can exploit millimetre-like edge gains.
      const edgeSkill=((p.stats.cornering+p.stats.insideLine+p.stats.control)/3-72)/27;
      score += Math.pow(Math.abs(c),5)*.015; // v4.03: no wall-scrape penalty for air units

      // v29: cornering/inside-line/route-reading and personality determine
      // how aggressively the racer trusts the shortest apex.
      const skill=(lineSkill-72)/27;
      const risk=(p.stats.riskControl-72)/27;
      const attack=p.drivingStyle.attack;
      score *= (1.045-skill*0.050);
      score += Math.abs(c)*Math.max(0,1-risk)*0.22/attack;

      if(score<bestScore){
        bestScore=score;
        bestOff=off;
      }
    }

    p.linePlanOffset=bestOff;
    p.linePlanUntil=now+245+Math.random()*115;
    return bestOff;
  }



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

  function extremeInsideAdjustment(p,si,now,baseOff){
    // v4.63: on an observer-free road, never invent a risky/slow personality route.
    if(playerPerceivedObservers(p,18.0).length===0){
      p.extremeInsideActive=false; p.extremeInsideFail=false;
      return baseOff;
    }
    const side=cornerInsideSide(si);
    const power=cornerIntensity(si);
    if(now>=p.extremeInsideUntil){
      p.extremeInsideActive=false;
      p.extremeInsideFail=false;
    }
    if(side!==0 && power>.055 && !p.extremeInsideActive && now>=p.extremeInsideCooldown){
      const inside=Math.max(0,Math.min(1,(p.stats.insideLine-72)/27));
      const corner=Math.max(0,Math.min(1,(p.stats.cornering-72)/27));
      const control=Math.max(0,Math.min(1,(p.stats.control-72)/27));
      const read=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
      const aggression=Math.max(0,Math.min(1,(p.stats.aggression-72)/27));
      const styleAttack=Math.max(-.25,Math.min(.25,(p.drivingStyle.attack-p.drivingStyle.safety)));
      // Everyone has a small chance; elite inside-line racers try it much more often.
      const attemptChance=.055 + inside*.185 + Math.max(0,styleAttack)*.075 + aggression*.030;
      if(Math.random()<attemptChance){
        const successChance=Math.max(.42,Math.min(.94,.50+inside*.16+corner*.11+control*.10+read*.08-aggression*.045));
        p.extremeInsideActive=true;
        p.extremeInsideFail=Math.random()>=successChance;
        p.extremeInsideSide=side;
        p.extremeInsideUntil=now+720+Math.random()*520;
        p.extremeInsideCooldown=now+1500+Math.random()*1800;
      }else{
        p.extremeInsideCooldown=now+420+Math.random()*650;
      }
    }
    if(!p.extremeInsideActive || !p.extremeInsideSide) return baseOff;
    const routeHalf=Math.max(2.0,widths[si]*ROAD_MARGIN);
    // v7.87: this is execution style only. Edge rails are pass-through, so a deep
    // attempt may visibly cross the rail but is never treated as a wall collision/death.
    const depth=routeHalf+DEATH_EDGE_EXTRA+(p.extremeInsideFail?.78:-.62);
    return p.extremeInsideSide*depth;
  }

  function stabilizeDrivingLine(p,si,targetOff){
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.54);
    const density=playerPerceivedObservers(p,15).length;
    const corner=cornerIntensity(si);
    const lineSkill=((p.stats.cornering+p.stats.insideLine+p.stats.control)/3-72)/27;

    // v2.27: on a genuinely clear corner, high-skill racers may use the full
    // extreme inside edge. Traffic progressively restores a larger safety margin.
    let edge;
    if(density===0 && corner>.045) edge=.999;
    else edge=density>=7?.82:density>=4?.87:.94;
    targetOff=Math.max(-half*edge,Math.min(half*edge,targetOff));

    if(p._stableOff==null) p._stableOff=targetOff;
    const maxStep=half*(.105+lineSkill*.065);
    const delta=targetOff-p._stableOff;
    p._stableOff+=Math.max(-maxStep,Math.min(maxStep,delta));
    return p._stableOff;
  }

  function humanDrivingAdjustment(p,si,now,baseOff){
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.54);
    const control=(p.stats.control-72)/27;
    const reaction=(p.stats.reaction-72)/27;
    const prediction=(p.stats.prediction-72)/27;
    const stability=(p.stats.stability-72)/27;
    const risk=(p.stats.riskControl-72)/27;

    if(now>=p.humanModeUntil){
      const formShift=(1-p.raceForm)*.32;
      const roll=Math.max(0,Math.min(1,Math.random()+formShift));
      if(roll<.10) p.humanMode=1;       // compact weave
      else if(roll<.15) p.humanMode=2;  // short wait
      else if(roll<.22) p.humanMode=3;  // wide safety line
      else p.humanMode=0;
      p.humanModeUntil=now+420+Math.random()*680;
      p.humanPhase+=1.11;
    }

    let off=baseOff, speedMul=1;

    // v4.67 OPTIMAL-LINE DISCIPLINE:
    // Never take a deliberately wide route merely for personality/safety.
    // Wide movement is reserved for a real observer threat handled by avoidance.
    const survival=p.survivalNorm||0;
    const inside=cornerInsideSide(si)||Math.sign(futureInsideBias(si));
    p.wideDetourRace=false;

    if(p.humanMode===1){
      off+=Math.sin(now*.012+p.humanPhase)*half*(.025+(1-control)*.045);
    }else if(p.humanMode===2){
      // v4.86: no cosmetic clear-road hesitation; judgment differences appear under pressure.
      speedMul=playerPerceivedObservers(p,18).length===0?1:(.965+reaction*.020+prediction*.012);
    }else if(p.humanMode===3){
      // v4.67: no cosmetic/safety-wide lane. Keep the optimized line.
      off=baseOff;
      speedMul=1;
    }

    if(now>=p.decisionErrorUntil){
      const errorChance=.0012+(1-(reaction+prediction+stability)/3)*.0048;
      if(Math.random()<errorChance) p.decisionErrorUntil=now+170+Math.random()*210;
    }
    if(now<p.decisionErrorUntil){
      off+=Math.sin(now*.018+p.index)*half*(.012+(1-stability)*.025);
      speedMul*=.988;
    }
    // v2.45: persistent individual route identity keeps racers from stacking
    // on the same optimized line even when no observer forces a deviation.
    const clearIdentity68=playerPerceivedObservers(p,18).length===0;
    const identityWave=Math.sin(now*.00115+p.routeIdentityPhase)*half*(clearIdentity68?.012:.10) +
      (p.laneSignatureWave||0)*half*(clearIdentity68?.04:1);
    const identityBias=(p.routeIdentityBias||0)*half*(clearIdentity68?.025:.24);
    const approachInside=openingInsideBias(si);
    const openingFast=openingFastLineTarget(p,si);
    const identityKeep=clearIdentity68?.985:(openingFast!=null ? .88 : (Math.abs(approachInside)>.08 ? .92 : .79));
    const identityScale=clearIdentity68?.08:(openingFast!=null ? .42 : (Math.abs(approachInside)>.08 ? .34 : 1));
    off=off*identityKeep + (identityBias + identityWave)*identityScale;
    if(openingFast!=null) off=off*.18+openingFast*.82;
    off=creativeRouteAdjustment(p,si,now,off);
    return {off:Math.max(-half*.995,Math.min(half*.995,off)),speedMul};
  }


  // v2.14: start / finish / clutch situation logic.
  // No trailing-speed bonus: late-race changes are route/risk/decision changes only.
  function finalCornerBattleTarget(p,si,now,baseOff){
    const ratio=Math.max(0,Math.min(1,currentProgress(p)/routeLength));
    if(ratio<.88) return baseOff;
    let nearest=999,ahead=999;
    const my=currentProgress(p);
    for(const q of players){
      if(q===p||q.done) continue;
      const g=currentProgress(q)-my;
      nearest=Math.min(nearest,Math.abs(g));
      if(g>0) ahead=Math.min(ahead,g);
    }
    if(nearest>5.8) return baseOff;
    const side=cornerInsideSide(si)||Math.sign(futureInsideBias(si));
    if(!side) return baseOff;
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.585);
    const pressure=(p.stats.pressure-72)/27;
    const control=(p.stats.control-72)/27;
    const inside=(p.stats.insideLine-72)/27;
    const attack=Math.max(0,Math.min(1,(pressure+control+inside)/3));
    const chasing=ahead<5.8;
    const commit=chasing?Math.min(.999,.91+attack*.085):Math.min(.985,.82+attack*.12);
    const target=side*half*commit;
    if(now<p.finalCornerUntil) return baseOff*.20+p.finalCornerOffset*.80;
    p.finalCornerOffset=target;
    p.finalCornerUntil=now+420+attack*240;
    return baseOff*.28+target*.72;
  }

  function limitDecisionChanges(p,si,now,targetOff){
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.58);
    const nearby=playerPerceivedObservers(p,8.5);
    let emergency=false;
    for(const o of nearby){
      const dx=o.x-p.x,dy=o.y-p.y;
      if(dx*dx+dy*dy<8.0){emergency=true;break;}
    }
    if(emergency){
      p.decisionLockUntil=0;
      p.decisionLockOffset=targetOff;
      return targetOff;
    }
    if(now<p.decisionLockUntil){
      const delta=Math.abs(targetOff-p.decisionLockOffset);
      const sideFlip=Math.sign(targetOff)!==0&&Math.sign(p.decisionLockOffset)!==0&&
        Math.sign(targetOff)!==Math.sign(p.decisionLockOffset);
      if(sideFlip || delta>half*.52) return p.decisionLockOffset*.78+targetOff*.22;
      return p.decisionLockOffset*.55+targetOff*.45;
    }
    p.decisionLockOffset=targetOff;
    const stability=(p.stats.stability-72)/27;
    p.decisionLockUntil=now+260+stability*190;
    return targetOff;
  }

  function segmentPointDistanceSq(ax,ay,bx,by,px,py){
    const vx=bx-ax,vy=by-ay,wx=px-ax,wy=py-ay;
    const vv=vx*vx+vy*vy;
    if(vv<1e-10){const dx=px-ax,dy=py-ay;return dx*dx+dy*dy;}
    const t=Math.max(0,Math.min(1,(wx*vx+wy*vy)/vv));
    const dx=(ax+vx*t)-px,dy=(ay+vy*t)-py;
    return dx*dx+dy*dy;
  }
  function playerObserverHit(p,o){
    // v3.7 RELATIVE-MOTION SWEPT COLLISION:
    // Sweep BOTH moving objects over the same 20 ms simulation step.
    // In relative coordinates this is one segment from
    // (playerPrev-observerPrev) to (playerNow-observerNow) against the origin.
    // This prevents fast crossing contacts from being missed and avoids inflating HIT.
    const r=playerHitRadius764(p);
    const opx=Number.isFinite(o.simPrevX)?o.simPrevX:o.x;
    const opy=Number.isFinite(o.simPrevY)?o.simPrevY:o.y;
    const r0x=p.simPrevX-opx, r0y=p.simPrevY-opy;
    const r1x=p.x-o.x, r1y=p.y-o.y;
    if(segmentPointDistanceSq(r0x,r0y,r1x,r1y,0,0)<r*r) return true;
    return r1x*r1x+r1y*r1y<r*r;
  }

  // v4.48 START AI: racers still spawn at exactly the same v6.04 start-safe coordinate. Start, Reaction,
  // Acceleration and personality decide how quickly and how strongly each racer fans into
  // a legal opening line. Observer avoidance below always has final authority.
  function startOpeningTarget(p,si,now,targetOff){
    if(!raceStart || now>=p.startDecisionUntil || si>2) return targetOff;
    const elapsed=Math.max(0,now-raceStart-p.startReactionMs);
    if(elapsed<=0) return targetOff;
    const startN=Math.max(0,Math.min(1,(p.stats.start-72)/27));
    const reactN=Math.max(0,Math.min(1,(p.stats.reaction-72)/27));
    const accelN=Math.max(0,Math.min(1,(p.stats.acceleration-72)/27));
    const controlN=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const identity=identityOf(p);
    const ramp=Math.max(0,Math.min(1,elapsed/(330-reactN*90)));
    const settle=Math.max(0,Math.min(1,(p.startDecisionUntil-now)/620));
    const blend=Math.min(.84,(.34+startN*.20+reactN*.10+controlN*.08)*(p.startLineCommit||.7)*1.24*ramp*Math.max(.48,settle));
    // Strong starters establish their chosen lane earlier; acceleration affects execution, not hidden pace.
    let executed=p.startLineTarget*(.86+accelN*.10+controlN*.04);
    // v4.62: while the first-corner optimizer is available, trust its topology-derived
    // fast side more than the old personal opening lane. This specifically prevents
    // a racer from choosing a visibly slower side on the long opening approach.
    const openingFast=openingFastLineTarget(p,si);
    if(openingFast!=null){
      const fastTrust=.82+Math.max(0,Math.min(1,(p.stats.routeReading-72)/27))*.10;
      executed=executed*(1-fastTrust)+openingFast*fastTrust;
    }
    return targetOff*(1-blend)+executed*blend;
  }

  
  // v4.80-v4.84 INTEGRATED OBSERVER AI
  // 4.80 future-threat prediction 3.0 / 4.81 minimum dodge 2.0 /
  // 4.82 inside-line preservation / 4.83 multi-observer escape corridor 3.0 /
  // 4.84 instant optimal-line rejoin 5.0.
  function fastReference84(p,si){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const macro=optimalRacingLine2Offset(p,idx);
    const corner=cornerPhysics64Target(p,idx,macro).off;
    const linked=integratedFastLine74(p,idx,corner);
    return raceLine79(p,idx,linked,false);
  }

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
      const projected=tc<3.45 && cpa<5.4;
      const occupied=along>-.6 && along<12.5 && Math.abs(lat)<4.6;
      if(projected || occupied) out.push({o,along,lat,tc,cpa});
    }
    out.sort((a,b)=>(a.tc-b.tc)||(a.cpa-b.cpa));
    return out;
  }

  function minimumEscape84(p,s,legacy,now){
    if(!legacy || legacy.mode==="stop") return legacy;
    const threats=predictedThreatSet84(p,s,now,28);
    if(!threats.length) return null;

    const nearby=threats.map(t=>t.o);
    const idx=Math.min(p.seg,widths.length-1);
    const half=Math.max(1.8,widths[idx]*ROAD_MARGIN*.965);
    const fast=fastReference84(p,idx);
    const current=((p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny);
    const skill=Math.max(0,Math.min(1,
      (((p.stats.avoidance+p.stats.prediction+p.stats.reaction+p.stats.control)/4)-72)/27));
    const required=2.15+skill*.28;

    // 4.81/4.82: search from the fastest inside line outward. The first genuinely
    // safe compact lane wins; do not jump to the legacy wide dodge by default.
    const legacyOff=Number.isFinite(legacy.targetOff)?legacy.targetOff:fast;
    const toward=legacyOff-fast;
    const candidates=[
      fast,
      fast+toward*.22,
      fast+toward*.38,
      fast+toward*.55,
      fast+toward*.72,
      legacyOff
    ];

    // 4.83: with several observers, also inspect compact escape corridors on BOTH
    // sides, but keep the search close to the racing line before considering extremes.
    if(threats.length>=2){
      for(const f of [.18,.32,.46,.60]){
        candidates.push(fast-half*f,fast+half*f);
      }
    }

    let best=null;
    const seen=[];
    for(let off of candidates){
      off=clampRoadOffset(idx,off,p);
      if(seen.some(v=>Math.abs(v-off)<.08)) continue;
      seen.push(off);
      const risk=candidateAvoidanceRisk(p,s,off,legacy.speedMul||.998,nearby);
      const deviation=Math.abs(off-fast);
      // Prefer safety first, then minimum movement and preservation of the fast/inside lane.
      const safeEnough=risk.minClear>=required;
      const score=risk.score + deviation*(safeEnough?.52:.10) + Math.abs(off-current)*.06;
      if(!best || (safeEnough&&!best.safeEnough) ||
         (safeEnough===best.safeEnough && score<best.score)){
        best={off,risk,score,safeEnough};
      }
    }
    if(!best) return legacy;

    // If no compact candidate meets required clearance, trust the safest scored lane,
    // but cap gratuitous exterior travel unless this is a true close emergency.
    let off=best.off;
    const emergency=best.risk.minClear<1.12 || threats.some(t=>t.tc<.62 && t.cpa<1.55);
    const maxDev=half*(emergency?.88:(threats.length>=2?.66:.54));
    const d=off-fast;
    if(Math.abs(d)>maxDev) off=fast+Math.sign(d)*maxDev;

    return {
      mode:legacy.mode||"planned",
      targetOff:clampRoadOffset(idx,off,p),
      speedMul:legacy.speedMul||.998,
      risk:best.risk.score,
      minClear:best.risk.minClear,
      threatCount84:threats.length
    };
  }

  function chooseAvoidance(p,s,now){
    const legacy=chooseAvoidanceLegacy84(p,s,now);
    return minimumEscape84(p,s,legacy,now);
  }


  // v4.85-v4.89 RACE AI 5.0 COMPLETION
  // 4.85 leader survival 2.0 / 4.86 human judgment 3.0 /
  // 4.87 stat-driven execution 3.0 / 4.88 unified situation score 4.0 /
  // 4.89 final race-AI balance and anti-abnormal-routing pass.
  function executionSkill87(p){
    const inside=Math.max(0,Math.min(1,(p.stats.insideLine-72)/27));
    const corner=Math.max(0,Math.min(1,(p.stats.cornering-72)/27));
    const control=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const read=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
    const predict=Math.max(0,Math.min(1,(p.stats.prediction-72)/27));
    return inside*.24+corner*.22+control*.21+read*.18+predict*.15;
  }

  function situationScore88(p,si,now,targetOff,avoid=null,passActive=false){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const half=Math.max(1.8,widths[idx]*ROAD_MARGIN*.965);
    const fast=fastReference84(p,idx);
    const rs=liveRaceSituation(p);
    const exec=executionSkill87(p);

    let threat=0;
    if(avoid){
      const mc=Number.isFinite(avoid.minClear)?avoid.minClear:9;
      threat=Math.max(0,Math.min(1,(3.2-mc)/3.2));
    }
    const leaderPressure=(rs.rank===1 && rs.nearestBehindGap<7.5) ||
                         (rs.rank===2 && rs.nearestAheadGap<7.5);
    const routeCost=Math.min(1,Math.abs(targetOff-fast)/Math.max(1,half));
    const passNeed=passActive?1:0;

    // 4.88: route time, observer danger, traffic, next-corner geometry and recovery
    // are collapsed into one compact authority score.
    let fastAuthority=.86 + exec*.10;
    fastAuthority += leaderPressure?.025:0;
    fastAuthority -= threat*.42;
    fastAuthority -= passNeed*.24;
    fastAuthority -= routeCost*.05;
    fastAuthority=Math.max(.42,Math.min(.985,fastAuthority));
    return {fast,fastAuthority,threat,leaderPressure,exec};
  }

  function finalRaceDiscipline89(p,si,now,targetOff,avoid=null,passActive=false){
    const info=situationScore88(p,si,now,targetOff,avoid,passActive);
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const half=Math.max(1.8,widths[idx]*ROAD_MARGIN*.965);

    // 4.85 leaders: survive, but never panic-route unless there is a real close threat.
    if(info.leaderPressure && avoid && info.threat<.42){
      const cap=half*.40;
      const d=targetOff-info.fast;
      targetOff=info.fast+Math.sign(d)*Math.min(Math.abs(d),cap);
    }

    // 4.89 final abnormal-route clamp. On clear road there is no justification for
    // a large exterior excursion. During a pass or threat, allow proportionate room.
    const maxDev=half*(avoid ? (.48+info.threat*.30) : (passActive?.46:.20));
    const d=targetOff-info.fast;
    if(Math.abs(d)>maxDev){
      targetOff=info.fast+Math.sign(d)*maxDev;
    }

    // 4.87: stronger racers execute the same optimal route more precisely; weaker
    // racers differ by small timing/precision error, never by deliberately bad macro paths.
    const precisionAuthority=avoid ? Math.max(.18,info.fastAuthority*.34) : info.fastAuthority;
    targetOff=targetOff*(1-precisionAuthority)+info.fast*precisionAuthority;
    return clampRoadOffset(idx,targetOff,p);
  }


  // v5.01 HORIZONTAL CENTERLINE LOCK
  function horizontalCenterLock501(p,si,now){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[idx];
    const next=segs[Math.min(segs.length-1,idx+1)];
    const horizontal=Math.abs(s.ux)>=.88;
    const nextCompatible=!next || Math.abs(next.ux)>=.72;
    const emergency=
      now<(p.hardRouteLockUntil||0) ||
      now<(p.routeBreakCombatUntil||0) ||
      (p.liveEvadeDanger||0)>.18 ||
      !!p.liveEvadeThreat;
    if(!horizontal || !nextCompatible || emergency) return false;
    // v5.07: simply seeing an observer nearby no longer disables broad-road center travel.
    // Only a real live-evade/emergency may override it.
    return true;
  }


  // v5.03 HORIZONTAL SEGMENT HOLD
  // Preserve the current horizontal segment until its endpoint is genuinely reached.
  // This prevents early segment switching from pulling the target vertically.
  function horizontalHold503(p,si){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[idx];
    if(Math.abs(s.ux)<.88) return false;
    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    const along=rx*s.ux+ry*s.uy;
    return along < s.L*.985;
  }


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
  function middleUpperLine508(si){
    return si>=13 && si<=18;
  }

  function finalStraight508(si){
    return si>=28 && si<=32;
  }

  function middleUpperTarget508(p,si){
    if(!middleUpperLine508(si)) return null;
    const s=segs[si];
    const half=Math.max(1.8,widths[si]*ROAD_MARGIN*.96);

    // Route direction here is right->left. Positive/negative normal sign can vary
    // by segment, so choose the candidate with smaller world Y = visually upper.
    const c1={x:s.b[0]+s.nx*half*.58,y:s.b[1]+s.ny*half*.58};
    const c2={x:s.b[0]-s.nx*half*.78,y:s.b[1]-s.ny*half*.78};
    const upper=c1.y<c2.y?c1:c2;

    // Keep the path on the real broad road; edge row remains legal but this target
    // stays slightly inside it rather than sitting on the one-tile border.
    if(roadChordLegal507(p.x,p.y,upper.x,upper.y,ROUTE_PLAN_EXTRA)) return upper;

    // If the far endpoint is too aggressive, use a forward point on the same upper lane.
    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
    const ahead=Math.min(s.L,along+Math.max(4.0,Math.min(8.0,s.L-along)));
    const ax=s.a[0]+s.ux*ahead;
    const ay=s.a[1]+s.uy*ahead;
    const u1={x:ax+s.nx*half*.56,y:ay+s.ny*half*.76};
    const u2={x:ax-s.nx*half*.76,y:ay-s.ny*half*.76};
    const upperAhead=u1.y<u2.y?u1:u2;
    return roadChordLegal507(p.x,p.y,upperAhead.x,upperAhead.y,ROUTE_PLAN_EXTRA)
      ? upperAhead
      : null;
  }

  function finalHorizontalTarget508(p,si,now){
    if(!finalStraight508(si)) return null;
    const s=segs[si];

    // Capture exit Y once when entering the final horizontal corridor.
    if(!Number.isFinite(p.finalStraightY508) || p.finalStraightSeg508>si){
      p.finalStraightY508=p.y;
    }
    p.finalStraightSeg508=si;

    // Aim straight to the final route endpoint while preserving the captured Y.
    // If that exact horizontal chord is not legal yet, aim as far forward as possible
    // on the same Y, then extend again next frame.
    const finish=route[route.length-1];
    const dir=Math.sign(finish[0]-p.x)||1;
    const finishX=finish[0];
    const y=p.finalStraightY508;

    if(roadChordLegal507(p.x,p.y,finishX,y,ROUTE_PLAN_EXTRA)){
      return {x:finishX,y};
    }

    const maxStep=8.0;
    for(let d=maxStep;d>=4.0;d-=1.0){
      const x=p.x+dir*d;
      if(roadChordLegal507(p.x,p.y,x,y,ROUTE_PLAN_EXTRA)){
        return {x,y};
      }
    }
    return null;
  }

  function broadRoadTarget507(p,si,now){
    const start=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[start];

    const emergency=
      now<(p.hardRouteLockUntil||0) ||
      now<(p.routeBreakCombatUntil||0) ||
      (p.liveEvadeDanger||0)>.18 ||
      !!p.liveEvadeThreat ||
      p.controlMode!=="normal";
    if(emergency) return null;

    // v5.08 explicit fast-line authority for the two user-specified horizontal runs.
    const final508=finalHorizontalTarget508(p,start,now);
    if(final508) return {...final508,kind:"final-horizontal-508"};

    const upper508=middleUpperTarget508(p,start);
    if(upper508) return {...upper508,kind:"middle-upper-508"};

    // Broad-road detection: use actual route width, but avoid forcing narrow connectors.
    const broad = widths[start] >= 7.8;
    if(!broad) return null;

    // Search forward for the farthest route-centered point that is directly visible
    // through legal road. Candidate lateral offset is intentionally ZERO by default:
    // edge rows are allowed but never the preferred baseline.
    let best=null;
    let bestScore=-1e9;
    const maxAhead=Math.min(segs.length-1,start+4);

    for(let j=start;j<=maxAhead;j++){
      const sj=segs[j];
      const samples=(j===start)?[.58,.72,.84]:[.28,.46,.62,.76];

      for(const t of samples){
        // centerline candidate of future segment
        const x=sj.a[0]+(sj.b[0]-sj.a[0])*t;
        const y=sj.a[1]+(sj.b[1]-sj.a[1])*t;

        const dx=x-p.x, dy=y-p.y;
        const d=Math.hypot(dx,dy);
        if(d<3.5) continue;

        // must be reasonably forward from current heading
        const forward=(dx*s.ux+dy*s.uy);
        if(forward<1.2 && j<=start+1) continue;

        if(!roadChordLegal507(p.x,p.y,x,y,ROUTE_PLAN_EXTRA)) continue;

        // Favor farther progress and straighter motion. Penalize large lateral deviation
        // from the current segment direction, which is what makes edge/L doglegs unattractive.
        const progress=(j-start)+t;
        const lat=Math.abs(dx*s.nx+dy*s.ny);
        const straightness=Math.max(0,forward)/(d||1);
        const score=progress*12 + straightness*7 - lat*.42;

        if(score>bestScore){
          bestScore=score;
          best={x,y,d,j,t};
        }
      }
    }

    if(!best) return null;

    // v5.09 MOVEMENT-RADIUS LIMIT:
    // Never let calm broad-road planning send a racer far across the map in one decision.
    // Keep targets local so race position changes come from actual driving, not giant line swaps.
    const dx=best.x-p.x, dy=best.y-p.y;
    const d=Math.hypot(dx,dy);
    const maxTargetDist=11.0;
    if(d>maxTargetDist){
      const k=maxTargetDist/d;
      const lx=p.x+dx*k;
      const ly=p.y+dy*k;
      if(roadChordLegal507(p.x,p.y,lx,ly,ROUTE_PLAN_EXTRA)){
        best={...best,x:lx,y:ly,d:maxTargetDist};
      }
    }
    return best;
  }


  // v5.13 INTEGRATED STABILITY (v5.10~v5.13)
  function stabilizeTarget513(p,si,now,tx,ty,liveEvade){
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    if(!s || liveEvade || p.controlMode!=="normal") return {x:tx,y:ty};
    let dx=tx-p.x, dy=ty-p.y;
    let forward=dx*s.ux+dy*s.uy;
    let lateral=dx*s.nx+dy*s.ny;

    // v5.10: separate forward and lateral movement radius.
    const maxForward=Math.max(6.0,Math.min(10.0,s.L*.72));
    const maxLateral=Math.max(.75,Math.min(1.85,widths[si]*.18));
    forward=Math.max(2.0,Math.min(maxForward,forward));
    lateral=Math.max(-maxLateral,Math.min(maxLateral,lateral));

    // v5.13: straight-road stability; strongly suppress lane hunting.
    const next=segs[Math.min(segs.length-1,si+1)];
    const turn=next ? Math.abs(s.ux*next.uy-s.uy*next.ux) : 0;
    if(turn<.055){
      const currentOff=(p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny;
      const desiredLat=Math.max(-.70,Math.min(.70,-currentOff*.22));
      lateral=lateral*.22+desiredLat*.78;
    }

    // v5.12: suppress rapid left-right-left direction flips.
    const sign=Math.abs(lateral)>.12 ? Math.sign(lateral) : 0;
    if(!Number.isFinite(p.stableLatSign513)) p.stableLatSign513=sign;
    if(!Number.isFinite(p.stableLatFlipAt513)) p.stableLatFlipAt513=0;
    if(sign && p.stableLatSign513 && sign!==p.stableLatSign513){
      if(now-p.stableLatFlipAt513<520) lateral*=.18;
      else { p.stableLatFlipAt513=now; p.stableLatSign513=sign; }
    }else if(sign) p.stableLatSign513=sign;

    let candX=p.x+s.ux*forward+s.nx*lateral;
    let candY=p.y+s.uy*forward+s.ny*lateral;

    // v5.11: commit to a recent legal target briefly instead of retargeting every frame.
    const held=Number.isFinite(p.stableTargetX513)&&Number.isFinite(p.stableTargetY513);
    if(held && now<(p.stableTargetUntil513||0)){
      const hd=Math.hypot(p.stableTargetX513-p.x,p.stableTargetY513-p.y);
      if(hd>2.2 && roadChordLegal507(p.x,p.y,p.stableTargetX513,p.stableTargetY513,ROUTE_PLAN_EXTRA)){
        candX=p.stableTargetX513; candY=p.stableTargetY513;
      }
    }else if(roadChordLegal507(p.x,p.y,candX,candY,ROUTE_PLAN_EXTRA)){
      p.stableTargetX513=candX; p.stableTargetY513=candY; p.stableTargetUntil513=now+360;
    }
    return {x:candX,y:candY};
  }


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

  function stabilizeCorner516(p,si,now,tx,ty,liveEvade){
    if(liveEvade || p.controlMode!=="normal") return {x:tx,y:ty};

    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    if(!s) return {x:tx,y:ty};
    const phase=cornerPhase516(p,si);

    let dx=tx-p.x, dy=ty-p.y;
    let forward=dx*s.ux+dy*s.uy;
    let lateral=dx*s.nx+dy*s.ny;

    // v5.14 CORNER ENTRY:
    // once committed to a corner entry, do not make a last-second large lane swap.
    if(phase.entering){
      const currentOff=(p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny;
      const commit=Math.max(-1.10,Math.min(1.10,-currentOff*.16));
      lateral=lateral*.28+commit*.72;
      lateral=Math.max(-1.25,Math.min(1.25,lateral));
      p.cornerEntryLockUntil516=now+280;
      p.cornerEntryOff516=currentOff;
    }else if(now<(p.cornerEntryLockUntil516||0) && Number.isFinite(p.cornerEntryOff516)){
      lateral=lateral*.35+(-p.cornerEntryOff516*.12)*.65;
    }

    // v5.15 CORNER EXIT:
    // immediately after a corner, preserve the exit line for a short distance instead
    // of re-centering/re-targeting across the road.
    if(phase.exiting){
      if(!Number.isFinite(p.cornerExitOff516)){
        p.cornerExitOff516=(p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny;
      }
      const hold=p.cornerExitOff516;
      const desired=hold-((p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny);
      lateral=lateral*.22+desired*.78;
      lateral=Math.max(-1.05,Math.min(1.05,lateral));
      p.cornerExitHoldUntil516=now+360;
    }else if(now>=(p.cornerExitHoldUntil516||0)){
      p.cornerExitOff516=NaN;
    }

    const maxForward=Math.max(5.0,Math.min(9.0,s.L*.70));
    forward=Math.max(1.8,Math.min(maxForward,forward));

    const x=p.x+s.ux*forward+s.nx*lateral;
    const y=p.y+s.uy*forward+s.ny*lateral;
    return roadChordLegal507(p.x,p.y,x,y,ROUTE_PLAN_EXTRA) ? {x,y} : {x:tx,y:ty};
  }

  // v5.16 final steering layer.
  // Route/planner code may decide a desired target, but only this function converts it
  // into the local movement target used by the movement engine.
  function steeringTarget516(p,si,now,routeTarget,liveEvade){
    if(liveEvade || p.controlMode!=="normal") return routeTarget;

    const first=stabilizeTarget513(p,si,now,routeTarget.x,routeTarget.y,liveEvade);
    const second=stabilizeCorner516(p,si,now,first.x,first.y,liveEvade);
    return second;
  }


  // v5.19 INTEGRATED DIAGNOSTICS + STABILITY (v5.17~v5.19)

  function driveMode519(p,liveEvade,now){
    if(liveEvade) return "EVADE";
    if(now<(p.hardRouteLockUntil||0)) return "HARD";
    if(now<(p.routeBreakCombatUntil||0)) return "BREAK";
    if(p.controlMode && p.controlMode!=="normal") return String(p.controlMode).toUpperCase();
    return "CALM";
  }

  function recordDriveDebug519(p,si,now,routeTarget,steerTarget,moveX=0,moveY=0,liveEvade=false){
    p.debug519={
      seg:si,
      mode:driveMode519(p,liveEvade,now),
      rx:routeTarget?.x ?? p.x,
      ry:routeTarget?.y ?? p.y,
      sx:steerTarget?.x ?? p.x,
      sy:steerTarget?.y ?? p.y,
      mx:moveX,
      my:moveY,
      t:now,
      anomalies:p.anomalyCount519||0,
      source:p.routeSource523||"legacy"
    };
  }

  function detectAnomaly519(p,si,now,tx,ty,moveX,moveY){
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    if(!s) return;

    const dx=tx-p.x, dy=ty-p.y;
    const targetDist=Math.hypot(dx,dy);
    const lateralTarget=Math.abs(dx*s.nx+dy*s.ny);
    const lateralMove=Math.abs(moveX*s.nx+moveY*s.ny);

    let reason="";
    if(targetDist>13.5) reason="FAR_TARGET";
    else if(lateralTarget>2.4) reason="WIDE_TARGET";
    else if(lateralMove>.82) reason="WIDE_MOVE";

    const prev=p.lastMoveSign519||0;
    const cur=Math.abs(lateralMove)>.12 ? Math.sign(moveX*s.nx+moveY*s.ny) : 0;
    if(!reason && prev && cur && prev!==cur && now-(p.lastMoveFlip519||0)<420){
      reason="RAPID_FLIP";
    }

    if(cur && prev && cur!==prev) p.lastMoveFlip519=now;
    if(cur) p.lastMoveSign519=cur;

    if(reason){
      p.anomalyCount519=(p.anomalyCount519||0)+1;
      p.lastAnomaly519={reason,seg:si,x:p.x,y:p.y,tx,ty,t:now};
      p.anomalyUntil519=now+900;
    }
  }


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

  function hardRoadClamp619(p,si,target){
    if(!target) return null;
    // v7.891: visual road edges are not physical walls.
    if(currentMap770().edgePassThrough786) return target;
    if(courseContainsPoint(target.x,target.y,0.00) &&
       lineStaysOnCourse(p.x,p.y,target.x,target.y,0.00)) return target;

    for(let k=10;k>=1;k--){
      const t=k/11;
      const x=p.x+(target.x-p.x)*t;
      const y=p.y+(target.y-p.y)*t;
      if(courseContainsPoint(x,y,0.00) &&
         lineStaysOnCourse(p.x,p.y,x,y,0.00))
        return {x,y,kind:(target.kind||"target")+"-road619"};
    }
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    const x=p.x+s.ux*2.4, y=p.y+s.uy*2.4;
    return courseContainsPoint(x,y,0.00)?{x,y,kind:"road-fallback619"}:null;
  }

  function enforceRoadPosition619(p){
    // v7.895: visual road edges/rails are never physical walls.
    // The old fallback below was still restoring EVADE/REJOIN racers to their
    // previous legal coordinate after crossing an edge, which looked like a freeze.
    if(currentMap770().edgePassThrough786){
      if(courseContainsPoint(p.x,p.y,0.00)) p._lastLegal619={x:p.x,y:p.y};
      return;
    }
    if(courseContainsPoint(p.x,p.y,0.00)){
      p._lastLegal619={x:p.x,y:p.y};
      return;
    }
    if(p._lastLegal619){
      p.x=p._lastLegal619.x; p.y=p._lastLegal619.y;
      if(Number.isFinite(p.prevX)) p.prevX=p.x;
      if(Number.isFinite(p.prevY)) p.prevY=p.y;
      if(Number.isFinite(p.simPrevX)) p.simPrevX=p.x;
      if(Number.isFinite(p.simPrevY)) p.simPrevY=p.y;
      return;
    }
    const s=segs[Math.max(0,Math.min(segs.length-1,p.seg||0))];
    p.x=s.a[0]; p.y=s.a[1]; p._lastLegal619={x:p.x,y:p.y};
  }

  
  // v7.24 removed dead legacy AI: avoidance330


  function forceStartCenter625(p){
    const sp=mapStart770(),sx=sp.x,sy=sp.y;
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

  function finalRoadTarget636(p,si,target){
    if(!target) return null;
    // v7.891: do not clamp movement targets to visual edge rails.
    if(currentMap770().edgePassThrough786) return target;
    let t=hardRoadClamp619(p,si,target);
    if(!t){
      const s=segs[Math.max(0,Math.min(segs.length-1,si))];
      if(!s) return null;
      t={x:p.x+s.ux*2.2,y:p.y+s.uy*2.2,kind:"core-forward636"};
      t=hardRoadClamp619(p,si,t);
    }
    return t;
  }

  function enforcePhysicalRoad636(p){
    // v7.87: edge rails are non-solid on every active map. Do not project, snap or
    // restore a racer merely because it crossed the visual road edge.
    if(currentMap770().edgePassThrough786){
      if(courseContainsPoint(p.x,p.y,0.00)){
        p._lastLegal636={x:p.x,y:p.y};
        p._lastLegal619={x:p.x,y:p.y};
      }
      return true;
    }

    // The old order allowed OUTSIDE death before road containment ran.
    // v6.36 makes containment authoritative immediately after movement.
    if(courseContainsPoint(p.x,p.y,0.00)){
      p._lastLegal636={x:p.x,y:p.y};
      p._lastLegal619={x:p.x,y:p.y};
      return true;
    }

    const si=Math.max(0,Math.min(segs.length-1,p.seg||0));
    const s=segs[si];

    // First try projection onto the current route segment center corridor.
    if(s){
      const rx=p.x-s.a[0], ry=p.y-s.a[1];
      const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
      const lateral=rx*s.nx+ry*s.ny;
      const half=Math.max(1.8,(widths[si]||14)*ROAD_MARGIN*.94);
      const clampedLat=Math.max(-half,Math.min(half,lateral));
      const x=s.a[0]+s.ux*along+s.nx*clampedLat;
      const y=s.a[1]+s.uy*along+s.ny*clampedLat;
      if(courseContainsPoint(x,y,0.00)){
        p.x=x;p.y=y;
        p._lastLegal636={x,y};
        p._lastLegal619={x,y};
        return true;
      }
    }

    // Then restore the most recent legal position.
    const last=p._lastLegal636||p._lastLegal619;
    if(last && courseContainsPoint(last.x,last.y,0.00)){
      p.x=last.x;p.y=last.y;
      return true;
    }

    // Absolute fallback: yellow start-zone center.
    p.x=31.05;p.y=132.55;
    p.seg=0;
    p._lastLegal636={x:p.x,y:p.y};
    p._lastLegal619={x:p.x,y:p.y};
    return true;
  }

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

  function cameraSubject661(now){
    const cache=(raceFrameCache668.stamp===now)?raceFrameCache668:rebuildRaceFrameCache668(now);
    return cache.leader;
  }

  function closeBattleFrame662(leader,cache){
    if(!leader||!cache||cache.active.length<2) return {x:leader?.x||camX,y:leader?.y||camY,weight:1};
    const second=cache.active[1];
    const first=cache.active[0];
    const gap=Math.abs(first.prog-second.prog);
    if(gap>=0.70) return {x:leader.x,y:leader.y,weight:1};
    // Leader stays dominant; P2 only nudges composition.
    const w2=Math.max(.03,Math.min(.12,(.70-gap)*.15));
    return {x:leader.x*(1-w2)+second.p.x*w2,y:leader.y*(1-w2)+second.p.y*w2,weight:1};
  }

  function overtakeFrame663(leader,cache,now,base){
    if(!leader||!cache) return base;
    let challenger=null;
    for(const e of cache.active.slice(0,3)){
      if(e.p===leader) continue;
      if((e.p._overtake642Until||0)>now-180){challenger=e.p;break;}
    }
    if(!challenger) return base;
    // Overtake emphasis is modest and may never pull the camera away from P1.
    return {x:leader.x*.91+challenger.x*.09,y:leader.y*.91+challenger.y*.09,weight:1};
  }

  function packFrame664(leader,cache,base){
    if(!leader||!cache||cache.top.length<3) return base;
    const lp=cache.top[0].prog;
    const close=cache.top.filter(e=>lp-e.prog<1.45);
    if(close.length<3) return base;
    let cx=0,cy=0;
    for(const e of close){cx+=e.p.x;cy+=e.p.y;}
    cx/=close.length;cy/=close.length;
    // Maximum 10% pack influence, so actual P1 remains the camera anchor.
    return {x:leader.x*.90+cx*.10,y:leader.y*.90+cy*.10,weight:1};
  }

  function smoothCamera665(dt,tx,ty){
    const dx=tx-camX,dy=ty-camY;
    const dist=Math.hypot(dx,dy);
    const a=Math.min(.22,Math.max(.095,dt*.0062));
    let sx=dx*a,sy=dy*a;
    const maxStep=Math.max(1.25,dt*.115);
    const step=Math.hypot(sx,sy);
    if(step>maxStep&&step>0){sx*=maxStep/step;sy*=maxStep/step;}
    // Tiny dead zone prevents camera micro-jitter on nearly tied progress samples.
    if(dist<.10) return;
    camX+=sx;camY+=sy;
  }

  function sanitizeRaceState666(p){
    if(!p) return false;
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y)){
      const sp770=mapStart770();p.x=sp770.x;p.y=sp770.y;p.seg=0;
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

  function broadcastCamera695(now,dt,leader,cache){
    if(!leader) return;
    const s=segs[Math.max(0,Math.min(segs.length-1,leader.seg||0))];
    let frame=closeBattleFrame662(leader,cache);
    frame=overtakeFrame663(leader,cache,now,frame);
    frame=packFrame664(leader,cache,frame);

    // P1/leader stays the anchor. Add a small look-ahead in travel direction.
    if(s){
      const lead=1.15;
      const fx=leader.x+s.ux*lead, fy=leader.y+s.uy*lead;
      frame.x=frame.x*.88+fx*.12;
      frame.y=frame.y*.88+fy*.12;
    }
    smoothCamera665(dt,frame.x,frame.y);
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

  function nearestOptimalProgress710(x,y){
    let bestD=Infinity,bestP=0;
    for(const s of GLOBAL_OPTIMAL_SEGS_710){
      const t=Math.max(0,Math.min(1,((x-s.a[0])*s.dx+(y-s.a[1])*s.dy)/(s.L*s.L)));
      const qx=s.a[0]+s.dx*t,qy=s.a[1]+s.dy*t;
      const d=(x-qx)*(x-qx)+(y-qy)*(y-qy);
      if(d<bestD){bestD=d;bestP=s.start+s.L*t;}
    }
    return bestP;
  }


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
  function syncShortestSegment719(p,now){
    if(!p||p.dead||p.done||!segs.length)return;
    if((p.liveEvadeDanger||0)>.18||p.liveEvadeThreat||
       now<(p.hardRouteLockUntil||0)||now<(p.avoidance519Until||0))return;

    // v7.72: use the racer's monotonic spline progress instead of a global nearest
    // search. This prevents a self-crossing/overpass map from jumping to a later road.
    const splineTotal=Math.max(.001,RACING_SPLINE_SEGS_720.total||1);
    const prog=Math.max(0,Math.min(splineTotal,Number(p._splineProg720)||0));
    const target=(prog/splineTotal)*routeLength;
    let lo=0,hi=segs.length-1;
    while(lo<hi){
      const mid=(lo+hi)>>1,s=segs[mid];
      if(s.start+s.L<target)lo=mid+1;else hi=mid;
    }
    if(lo>p.seg)p.seg=lo;
  }

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

  function bindMapGeometry771(){
    Object.assign(MAP_DEFINITIONS_770["rubber_duck"],{image:"map_rubber_duck_772.png?v=772-approved-art",imageSize:{w:696,h:720},logicalSize:{w:172,h:178},start:{"x":126.331,"y":26.7},goal:{"x":61.09,"y":153.08},safeZones:{"start":{"x0":120.13,"y0":20.5,"x1":132.53,"y1":32.9},"goal":{"x0":54.89,"y0":146.88,"x1":67.29,"y1":159.28}},miniCrop:{"x":0,"y":0,"w":172,"h":178},sectorCuts:[0.17,0.34,0.51,0.68,0.84],sectorNames:["출발 구간","초반 승부처","중반 1","중반 2","후반 승부처","마지막 구간"],route770:[[126.331,26.7],[125.293,26.7],[124.255,26.7],[123.217,26.7],[121.66,26.7],[120.103,26.7],[118.72,26.7],[117.336,26.7],[115.952,26.7],[114.469,26.774],[112.986,26.848],[111.503,26.922],[109.922,27.071],[108.34,27.219],[106.759,27.367],[105.078,27.59],[103.398,27.812],[101.717,28.035],[99.938,28.332],[98.159,28.628],[96.379,28.925],[94.6,29.259],[92.821,29.593],[91.041,29.926],[89.262,30.297],[87.483,30.668],[85.703,31.039],[83.924,31.447],[82.145,31.855],[80.366,32.263],[78.586,32.708],[76.807,33.152],[75.028,33.597],[73.347,34.265],[71.667,34.932],[69.986,35.6],[68.405,36.49],[66.823,37.38],[65.241,38.27],[63.759,39.383],[62.276,40.495],[60.793,41.608],[59.409,42.943],[58.025,44.277],[56.641,45.612],[55.529,47.096],[54.417,48.579],[53.305,50.062],[52.465,51.694],[51.625,53.326],[50.784,54.957],[50.216,56.737],[49.648,58.517],[49.079,60.297],[48.783,62.226],[48.486,64.154],[48.19,66.082],[48.066,68.011],[47.943,69.939],[47.819,71.867],[47.868,73.796],[47.918,75.724],[47.967,77.652],[48.19,79.581],[48.412,81.509],[48.634,83.438],[49.03,85.366],[49.425,87.294],[49.821,89.222],[50.439,90.928],[51.056,92.634],[51.674,94.34],[52.514,95.823],[53.355,97.307],[54.195,98.79],[55.257,100.051],[56.32,101.312],[57.383,102.573],[58.668,103.611],[59.953,104.649],[61.238,105.688],[62.597,106.429],[63.956,107.171],[65.316,107.912],[66.749,108.358],[68.182,108.802],[69.616,109.248],[71.123,109.396],[72.63,109.544],[74.138,109.692],[75.72,109.544],[77.301,109.396],[78.883,109.248],[80.464,108.877],[82.046,108.506],[83.628,108.135],[85.209,107.542],[86.791,106.948],[88.372,106.355],[89.954,105.539],[91.536,104.723],[93.117,103.907],[94.699,102.869],[96.28,101.831],[97.862,100.792],[99.345,100.125],[100.828,99.457],[102.31,98.79],[103.694,98.493],[105.078,98.197],[106.462,97.9],[108.39,98.011],[110.317,98.123],[112.097,98.79],[113.876,99.457],[115.359,100.459],[116.841,101.46],[118.028,102.795],[119.214,104.13],[120.103,105.799],[120.993,107.468],[121.389,108.802],[121.784,110.138],[122.179,111.472],[122.402,113.364],[122.624,115.255],[122.476,117.035],[122.328,118.815],[121.809,120.484],[121.29,122.152],[120.4,123.71],[119.51,125.268],[118.324,126.491],[117.138,127.715],[115.655,128.605],[114.172,129.495],[112.393,130.051],[110.614,130.607],[109.23,130.756],[107.846,130.904],[106.462,131.052],[104.534,131.108],[102.607,131.164],[100.828,131.052],[99.048,130.941],[97.417,130.663],[95.786,130.385],[94.303,129.94],[92.821,129.495],[91.486,129.439],[90.152,129.384],[88.966,129.718],[87.779,130.051],[86.741,130.774],[85.703,131.498],[84.814,132.61],[83.924,133.722],[82.997,134.946],[82.071,136.17],[81.107,137.505],[80.143,138.84],[79.142,140.286],[78.141,141.733],[77.103,143.29],[76.066,144.847],[74.916,146.127],[73.767,147.406],[72.507,148.407],[71.247,149.409],[69.875,150.132],[68.503,150.855],[67.021,151.3],[65.538,151.745],[64.426,152.079],[63.314,152.412],[61.831,152.857],[61.09,153.08]],widths770:[10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8],extraRoads771:[],forbiddenZones770:[],geometryReady:true,approvedImageShape772:true});
    Object.assign(MAP_DEFINITIONS_770["ice_ring"],{image:"map_ice_ring_772.png?v=772-approved-art",imageSize:{w:696,h:720},logicalSize:{w:172,h:178},start:{"x":126.331,"y":24.92},goal:{"x":57.531,"y":142.4},safeZones:{"start":{"x0":120.13,"y0":18.72,"x1":132.53,"y1":31.12},"goal":{"x0":51.33,"y0":136.2,"x1":63.73,"y1":148.6}},miniCrop:{"x":0,"y":0,"w":172,"h":178},sectorCuts:[0.17,0.34,0.51,0.68,0.84],sectorNames:["출발 구간","초반 승부처","중반 1","중반 2","후반 승부처","마지막 구간"],route770:[[126.331,24.92],[125.441,24.698],[123.662,24.253],[122.328,23.919],[120.993,23.585],[119.214,23.14],[117.434,22.695],[115.507,22.306],[113.579,21.916],[112.195,21.694],[110.811,21.471],[109.428,21.249],[107.945,21.063],[106.462,20.878],[104.979,20.692],[103.398,20.544],[101.816,20.396],[100.234,20.248],[98.628,20.21],[97.022,20.173],[95.416,20.136],[93.784,20.21],[92.153,20.285],[90.522,20.359],[88.867,20.544],[87.211,20.73],[85.555,20.915],[83.875,21.212],[82.194,21.508],[80.514,21.805],[78.907,22.25],[77.301,22.695],[75.695,23.14],[74.163,23.733],[72.63,24.327],[71.098,24.92],[69.64,25.662],[68.182,26.403],[66.724,27.145],[65.34,28.035],[63.956,28.925],[62.572,29.815],[61.287,30.89],[60.002,31.966],[58.717,33.041],[57.531,34.302],[56.345,35.563],[55.159,36.824],[54.071,38.27],[52.984,39.716],[51.897,41.163],[50.908,42.794],[49.92,44.426],[48.931,46.057],[48.091,47.763],[47.251,49.469],[46.41,51.175],[45.718,52.955],[45.026,54.735],[44.334,56.515],[43.791,58.369],[43.247,60.223],[42.703,62.077],[42.308,64.006],[41.913,65.934],[41.517,67.862],[41.27,69.828],[41.023,71.793],[40.776,73.759],[40.702,75.261],[40.628,76.762],[40.553,78.264],[40.479,79.766],[40.516,81.296],[40.553,82.826],[40.591,84.355],[40.628,85.885],[40.776,87.442],[40.924,89.0],[41.072,90.557],[41.221,92.115],[41.567,94.08],[41.913,96.046],[42.259,98.011],[42.753,99.865],[43.247,101.72],[43.741,103.574],[44.384,105.317],[45.026,107.06],[45.669,108.802],[46.46,110.434],[47.251,112.066],[48.041,113.698],[48.931,115.181],[49.821,116.664],[50.71,118.148],[51.699,119.483],[52.687,120.818],[53.676,122.153],[54.763,123.339],[55.851,124.526],[56.938,125.713],[58.124,126.751],[59.31,127.789],[60.497,128.827],[61.732,129.718],[62.968,130.607],[64.203,131.498],[65.489,132.239],[66.774,132.981],[68.059,133.722],[69.393,134.316],[70.728,134.909],[72.062,135.502],[73.446,135.947],[74.83,136.393],[76.214,136.838],[77.363,137.338],[78.512,137.839],[78.957,138.506],[77.548,138.84],[75.917,138.84],[74.286,138.84],[72.692,138.951],[71.098,139.062],[69.541,139.285],[67.984,139.507],[66.465,139.841],[64.945,140.175],[63.462,140.62],[61.979,141.065],[60.867,141.399],[59.755,141.733],[58.272,142.178],[57.531,142.4]],widths770:[9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8],extraRoads771:[],forbiddenZones770:[],geometryReady:true,approvedImageShape772:true});
    Object.assign(MAP_DEFINITIONS_770["desert_oasis"],{image:"map_desert_oasis_772.png?v=772-approved-art",imageSize:{w:696,h:720},logicalSize:{w:172,h:178},start:{"x":100.234,"y":24.92},goal:{"x":104.979,"y":147.74},safeZones:{"start":{"x0":94.03,"y0":18.72,"x1":106.43,"y1":31.12},"goal":{"x0":98.78,"y0":141.54,"x1":111.18,"y1":153.94}},miniCrop:{"x":0,"y":0,"w":172,"h":178},sectorCuts:[0.17,0.34,0.51,0.68,0.84],sectorNames:["출발 구간","초반 승부처","중반 1","중반 2","후반 승부처","마지막 구간"],route770:[[100.234,24.92],[99.197,24.92],[98.159,24.92],[97.121,24.92],[95.564,24.92],[94.007,24.92],[92.623,24.92],[91.239,24.92],[89.855,24.92],[88.471,25.068],[87.087,25.217],[85.703,25.365],[84.32,25.662],[82.936,25.958],[81.552,26.255],[80.168,26.7],[78.784,27.145],[77.4,27.59],[76.016,28.183],[74.632,28.777],[73.248,29.37],[71.939,30.149],[70.629,30.928],[69.319,31.706],[68.083,32.67],[66.848,33.635],[65.612,34.599],[64.451,35.748],[63.289,36.898],[62.128,38.047],[61.04,39.383],[59.953,40.717],[58.866,42.052],[57.926,43.499],[56.987,44.945],[56.048,46.391],[55.257,47.949],[54.467,49.506],[53.676,51.064],[53.033,52.733],[52.391,54.401],[51.748,56.07],[51.254,57.85],[50.76,59.63],[50.266,61.41],[49.969,63.19],[49.672,64.97],[49.376,66.75],[49.277,68.53],[49.178,70.31],[49.079,72.09],[49.178,73.87],[49.277,75.65],[49.376,77.43],[49.672,79.21],[49.969,80.99],[50.266,82.77],[50.71,84.402],[51.155,86.033],[51.6,87.665],[52.193,89.148],[52.786,90.632],[53.379,92.115],[54.121,93.45],[54.862,94.785],[55.603,96.12],[56.493,97.307],[57.383,98.493],[58.272,99.68],[59.681,101.071],[61.09,102.461],[62.572,103.463],[64.055,104.464],[65.612,105.076],[67.169,105.688],[68.8,105.91],[70.431,106.132],[71.951,106.021],[73.471,105.91],[74.879,105.465],[76.288,105.02],[77.585,104.241],[78.883,103.462],[80.069,102.35],[81.255,101.238],[82.33,100.014],[83.405,98.79],[84.369,97.455],[85.333,96.12],[86.185,94.674],[87.038,93.228],[87.779,91.67],[88.521,90.113],[89.373,88.778],[90.226,87.443],[91.19,86.33],[92.153,85.218],[93.228,84.328],[94.303,83.438],[95.49,82.77],[96.676,82.103],[97.973,81.769],[99.271,81.435],[100.679,81.435],[102.088,81.435],[103.608,81.769],[105.128,82.103],[106.759,82.77],[108.39,83.438],[109.835,84.439],[111.281,85.44],[112.541,86.775],[113.802,88.11],[114.877,89.779],[115.952,91.447],[116.545,92.782],[117.138,94.117],[117.731,95.453],[118.201,96.899],[118.67,98.345],[119.14,99.791],[119.486,101.349],[119.832,102.906],[120.178,104.464],[120.4,106.132],[120.622,107.801],[120.845,109.47],[120.944,111.25],[121.043,113.03],[121.141,114.81],[121.092,116.479],[121.043,118.147],[120.993,119.816],[120.795,121.374],[120.598,122.931],[120.4,124.489],[120.054,125.935],[119.708,127.381],[119.362,128.827],[118.868,130.162],[118.374,131.497],[117.879,132.832],[116.99,134.612],[116.1,136.392],[115.062,137.95],[114.024,139.507],[112.838,140.843],[111.652,142.178],[110.317,143.29],[108.983,144.402],[107.982,145.237],[106.981,146.071],[105.647,147.184],[104.979,147.74]],widths770:[11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8,11.8],extraRoads771:[],forbiddenZones770:[],geometryReady:true,approvedImageShape772:true});
    Object.assign(MAP_DEFINITIONS_770["neon_city"],{image:"map_neon_city_772.png?v=772-approved-art",imageSize:{w:696,h:720},logicalSize:{w:172,h:178},start:{"x":114.469,"y":23.14},goal:{"x":68.207,"y":149.52},safeZones:{"start":{"x0":108.27,"y0":16.94,"x1":120.67,"y1":29.34},"goal":{"x0":62.01,"y0":143.32,"x1":74.41,"y1":155.72}},miniCrop:{"x":0,"y":0,"w":172,"h":178},sectorCuts:[0.17,0.34,0.51,0.68,0.84],sectorNames:["출발 구간","초반 승부처","중반 1","중반 2","후반 승부처","마지막 구간"],route770:[[114.469,23.14],[113.802,23.585],[112.467,24.475],[111.466,25.143],[110.466,25.81],[109.131,26.7],[107.797,27.59],[106.314,28.313],[104.831,29.036],[103.2,29.593],[101.569,30.149],[99.79,30.538],[98.01,30.927],[96.083,31.15],[94.155,31.373],[92.191,31.706],[90.226,32.04],[88.891,32.337],[87.557,32.633],[86.222,32.93],[84.863,33.301],[83.504,33.672],[82.145,34.042],[80.761,34.487],[79.377,34.932],[77.993,35.377],[76.609,35.934],[75.225,36.49],[73.841,37.046],[72.457,37.714],[71.074,38.381],[69.69,39.049],[68.306,39.828],[66.922,40.606],[65.538,41.385],[64.154,42.275],[62.77,43.165],[61.386,44.055],[60.076,45.056],[58.767,46.058],[57.457,47.059],[56.221,48.171],[54.986,49.284],[53.75,50.396],[52.589,51.62],[51.427,52.844],[50.266,54.067],[49.178,55.402],[48.091,56.738],[47.003,58.073],[46.163,59.37],[45.323,60.668],[44.483,61.966],[43.89,63.227],[43.297,64.488],[42.703,65.749],[42.184,67.584],[41.666,69.42],[41.517,71.2],[41.369,72.98],[41.628,74.482],[41.888,75.984],[42.555,77.208],[43.222,78.431],[44.297,79.377],[45.372,80.323],[46.855,80.99],[48.338,81.657],[50.006,82.214],[51.674,82.77],[53.528,83.215],[55.381,83.66],[56.74,83.882],[58.099,84.105],[59.459,84.327],[60.941,84.476],[62.424,84.624],[63.907,84.773],[65.39,84.958],[66.872,85.143],[68.355,85.329],[69.838,85.551],[71.321,85.774],[72.803,85.996],[74.286,86.256],[75.769,86.515],[77.252,86.775],[78.734,87.072],[80.217,87.368],[81.7,87.665],[83.133,88.036],[84.567,88.407],[86.0,88.778],[87.384,89.223],[88.768,89.668],[90.152,90.113],[91.486,90.632],[92.821,91.151],[94.155,91.67],[95.44,92.263],[96.725,92.857],[98.01,93.45],[99.246,94.117],[100.482,94.785],[101.717,95.453],[102.903,96.194],[104.09,96.936],[105.276,97.678],[106.413,98.493],[107.549,99.309],[108.686,100.125],[109.774,101.015],[110.861,101.905],[111.948,102.795],[113.32,104.186],[114.691,105.576],[115.803,107.022],[116.916,108.469],[117.768,109.971],[118.621,111.472],[119.214,113.03],[119.807,114.588],[120.103,116.034],[120.4,117.48],[120.4,118.815],[120.4,120.15],[120.103,121.374],[119.807,122.598],[119.214,123.71],[118.621,124.823],[117.842,125.657],[117.064,126.491],[116.1,127.048],[115.136,127.604],[113.987,127.882],[112.838,128.16],[111.503,128.16],[110.169,128.16],[108.797,127.882],[107.426,127.604],[106.017,127.048],[104.609,126.491],[103.163,125.657],[101.717,124.823],[100.234,123.71],[98.752,122.598],[97.269,121.429],[95.786,120.261],[94.303,119.038],[92.821,117.814],[91.338,116.534],[89.855,115.255],[88.372,113.92],[86.89,112.585],[85.37,111.472],[83.85,110.36],[82.293,109.47],[80.736,108.58],[79.142,107.912],[77.548,107.245],[75.917,106.8],[74.286,106.355],[72.692,106.244],[71.098,106.133],[69.541,106.355],[67.984,106.577],[66.465,107.134],[64.945,107.69],[63.462,108.58],[61.979,109.47],[60.608,110.527],[59.236,111.584],[57.976,112.808],[56.716,114.031],[55.566,115.422],[54.417,116.812],[53.379,118.37],[52.341,119.927],[51.6,121.485],[50.859,123.042],[50.414,124.6],[49.969,126.157],[49.821,127.715],[49.672,129.272],[49.821,130.83],[49.969,132.387],[50.488,133.834],[51.007,135.28],[51.897,136.615],[52.786,137.95],[54.047,139.174],[55.307,140.398],[56.938,141.51],[58.569,142.622],[59.941,143.568],[61.312,144.514],[62.424,145.292],[63.536,146.071],[64.389,146.683],[65.241,147.295],[66.428,148.185],[67.317,148.852],[67.91,149.297],[68.207,149.52]],widths770:[12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8,12.8],extraRoads771:[],forbiddenZones770:[],geometryReady:true,approvedImageShape772:true});
    Object.assign(MAP_DEFINITIONS_770["double_hairpin"],{image:"map_double_hairpin_772.png?v=772-approved-art",imageSize:{w:696,h:720},logicalSize:{w:172,h:178},start:{"x":125.145,"y":24.92},goal:{"x":86.0,"y":147.74},safeZones:{"start":{"x0":118.94,"y0":18.72,"x1":131.34,"y1":31.12},"goal":{"x0":79.8,"y0":141.54,"x1":92.2,"y1":153.94}},miniCrop:{"x":0,"y":0,"w":172,"h":178},sectorCuts:[0.17,0.34,0.51,0.68,0.84],sectorNames:["출발 구간","초반 승부처","중반 1","중반 2","후반 승부처","마지막 구간"],route770:[[125.145,24.92],[123.884,24.92],[122.624,24.92],[121.364,24.92],[119.473,24.92],[117.583,24.92],[115.902,24.92],[114.222,24.92],[112.541,24.92],[110.836,24.92],[109.131,24.92],[107.426,24.92],[105.696,24.92],[103.966,24.92],[102.236,24.92],[100.482,24.92],[98.727,24.92],[96.972,24.92],[95.193,24.92],[93.414,24.92],[91.634,24.92],[89.88,24.994],[88.125,25.068],[86.371,25.143],[84.641,25.291],[82.911,25.439],[81.181,25.588],[79.476,25.81],[77.771,26.033],[76.066,26.255],[74.385,26.552],[72.705,26.848],[71.024,27.145],[69.492,27.59],[67.96,28.035],[66.428,28.48],[65.044,29.073],[63.66,29.667],[62.276,30.26],[61.04,31.002],[59.805,31.743],[58.569,32.485],[57.482,33.375],[56.394,34.265],[55.307,35.155],[54.417,36.156],[53.528,37.157],[52.638,38.159],[51.6,39.828],[50.562,41.496],[49.821,43.332],[49.079,45.168],[48.783,46.503],[48.486,47.837],[48.19,49.172],[47.967,51.119],[47.745,53.066],[47.745,54.957],[47.745,56.849],[47.967,58.684],[48.19,60.52],[48.634,62.3],[49.079,64.08],[49.821,65.693],[50.562,67.306],[51.6,68.752],[52.638,70.199],[53.972,71.478],[55.307,72.758],[56.938,73.87],[58.569,74.983],[59.805,75.539],[61.04,76.095],[62.276,76.651],[63.66,77.022],[65.044,77.393],[66.428,77.764],[67.96,77.949],[69.492,78.135],[71.024,78.32],[72.705,78.32],[74.385,78.32],[76.066,78.32],[77.771,78.357],[79.476,78.394],[81.181,78.431],[82.911,78.505],[84.641,78.58],[86.371,78.654],[88.125,78.765],[89.88,78.876],[91.634,78.988],[93.414,79.136],[95.193,79.284],[96.972,79.433],[98.554,79.729],[100.136,80.026],[101.717,80.323],[103.101,80.767],[104.485,81.213],[105.869,81.657],[107.648,82.547],[109.428,83.438],[110.91,84.55],[112.393,85.663],[113.616,86.998],[114.84,88.333],[115.803,89.89],[116.767,91.447],[117.472,93.227],[118.176,95.007],[118.472,96.343],[118.769,97.677],[119.066,99.013],[119.239,100.385],[119.411,101.757],[119.584,103.129],[119.634,104.538],[119.683,105.947],[119.733,107.356],[119.659,108.802],[119.584,110.249],[119.51,111.695],[119.313,113.178],[119.115,114.662],[118.917,116.145],[118.571,117.554],[118.225,118.963],[117.879,120.372],[117.385,121.707],[116.891,123.042],[116.397,124.377],[115.754,125.638],[115.111,126.899],[114.469,128.16],[113.678,129.347],[112.887,130.533],[112.097,131.72],[111.232,132.795],[110.367,133.871],[109.502,134.946],[108.563,135.91],[107.624,136.875],[106.684,137.839],[105.165,139.118],[103.645,140.398],[102.014,141.51],[100.383,142.622],[98.863,143.512],[97.343,144.402],[95.934,145.07],[94.526,145.737],[93.228,146.182],[91.931,146.627],[90.745,146.85],[89.559,147.072],[87.779,147.406],[86.593,147.629],[86.0,147.74]],widths770:[10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2],extraRoads771:[],forbiddenZones770:[],geometryReady:true,approvedImageShape772:true});
    Object.assign(MAP_DEFINITIONS_770["skyway"],{image:"map_skyway_772.png?v=772-approved-art",imageSize:{w:696,h:720},logicalSize:{w:172,h:178},start:{"x":112.097,"y":21.36},goal:{"x":38.552,"y":140.62},safeZones:{"start":{"x0":105.9,"y0":15.16,"x1":118.3,"y1":27.56},"goal":{"x0":32.35,"y0":134.42,"x1":44.75,"y1":146.82}},miniCrop:{"x":0,"y":0,"w":172,"h":178},sectorCuts:[0.17,0.34,0.51,0.68,0.84],sectorNames:["출발 구간","초반 승부처","중반 1","중반 2","후반 승부처","마지막 구간"],route770:[[112.097,21.36],[112.636,22.655],[113.175,23.949],[113.714,25.244],[114.253,26.538],[114.792,27.833],[115.332,29.127],[115.871,30.422],[116.41,31.716],[116.949,33.011],[117.488,34.305],[118.028,35.6],[117.92,37.056],[117.812,38.513],[117.704,39.969],[117.596,41.425],[117.488,42.882],[117.381,44.338],[117.273,45.795],[117.165,47.251],[117.057,48.707],[116.949,50.164],[116.841,51.62],[116.087,52.915],[115.332,54.209],[114.577,55.504],[113.822,56.798],[113.067,58.093],[112.312,59.387],[111.557,60.682],[110.803,61.976],[110.048,63.271],[109.293,64.565],[108.538,65.86],[107.352,66.669],[106.166,67.478],[104.979,68.287],[103.793,69.096],[102.607,69.905],[101.421,70.715],[100.234,71.524],[99.048,72.333],[97.862,73.142],[96.676,73.951],[95.49,74.76],[94.04,74.958],[92.59,75.156],[91.14,75.353],[89.69,75.551],[88.241,75.749],[86.791,75.947],[85.341,76.144],[83.891,76.342],[82.441,76.54],[81.137,75.828],[79.832,75.116],[78.527,74.404],[77.222,73.692],[75.917,72.98],[74.612,72.268],[73.308,71.556],[72.003,70.844],[70.698,70.132],[69.393,69.42],[68.563,68.174],[67.732,66.928],[66.902,65.682],[66.072,64.436],[65.241,63.19],[64.411,61.944],[63.581,60.698],[62.75,59.452],[61.92,58.206],[61.09,56.96],[61.09,55.576],[61.09,54.191],[61.09,52.807],[61.09,51.422],[61.09,50.038],[61.09,48.653],[61.09,47.269],[61.09,45.884],[61.09,44.5],[61.92,43.432],[62.75,42.364],[63.581,41.296],[64.411,40.228],[65.241,39.16],[66.072,38.092],[66.902,37.024],[67.732,35.956],[68.563,34.888],[69.393,33.82],[70.711,33.424],[72.029,33.029],[73.347,32.633],[74.665,32.238],[75.983,31.842],[77.301,31.447],[78.619,31.051],[79.937,30.656],[81.255,30.26],[82.573,30.853],[83.891,31.447],[85.209,32.04],[86.527,32.633],[87.845,33.227],[89.163,33.82],[90.481,34.413],[91.799,35.007],[93.117,35.6],[93.829,36.846],[94.541,38.092],[95.252,39.338],[95.964,40.584],[96.676,41.83],[97.388,43.076],[98.099,44.322],[98.811,45.568],[99.523,46.814],[100.234,48.06],[100.353,49.484],[100.472,50.908],[100.59,52.332],[100.709,53.756],[100.828,55.18],[100.946,56.604],[101.065,58.028],[101.183,59.452],[101.302,60.876],[101.421,62.3],[100.828,63.546],[100.234,64.792],[99.641,66.038],[99.048,67.284],[98.455,68.53],[97.862,69.776],[97.269,71.022],[96.676,72.268],[96.083,73.514],[95.49,74.76],[94.627,75.893],[93.764,77.025],[92.902,78.158],[92.039,79.291],[91.176,80.424],[90.313,81.556],[89.451,82.689],[88.588,83.822],[87.725,84.955],[86.863,86.087],[86.0,87.22],[85.473,88.604],[84.946,89.989],[84.418,91.373],[83.891,92.758],[83.364,94.142],[82.837,95.527],[82.31,96.911],[81.782,98.296],[81.255,99.68],[81.848,101.015],[82.441,102.35],[83.034,103.685],[83.628,105.02],[84.221,106.355],[84.814,107.69],[85.407,109.025],[86.0,110.36],[87.334,110.805],[88.669,111.25],[90.003,111.695],[91.338,112.14],[92.672,112.585],[94.007,113.03],[95.341,113.475],[96.676,113.92],[97.335,112.733],[97.994,111.547],[98.653,110.36],[99.312,109.173],[99.971,107.987],[100.63,106.8],[101.289,105.613],[101.948,104.427],[102.607,103.24],[102.162,101.905],[101.717,100.57],[101.272,99.235],[100.828,97.9],[100.383,96.565],[99.938,95.23],[99.493,93.895],[99.048,92.56],[97.693,92.051],[96.337,91.543],[94.981,91.034],[93.626,90.526],[92.27,90.017],[90.914,89.509],[89.559,89.0],[88.372,89.89],[87.186,90.78],[86.0,91.67],[84.814,92.56],[83.628,93.45],[82.441,94.34],[81.255,95.23],[80.069,96.12],[79.098,97.091],[78.128,98.062],[77.157,99.033],[76.187,100.004],[75.216,100.975],[74.246,101.945],[73.275,102.916],[72.305,103.887],[71.334,104.858],[70.364,105.829],[69.393,106.8],[68.423,107.933],[67.452,109.065],[66.482,110.198],[65.511,111.331],[64.54,112.464],[63.57,113.596],[62.599,114.729],[61.629,115.862],[60.658,116.995],[59.688,118.127],[58.717,119.26],[57.747,120.231],[56.776,121.202],[55.806,122.173],[54.835,123.144],[53.865,124.115],[52.894,125.085],[51.924,126.056],[50.953,127.027],[49.982,127.998],[49.012,128.969],[48.041,129.94],[47.092,131.008],[46.143,132.076],[45.194,133.144],[44.246,134.212],[43.297,135.28],[42.348,136.348],[41.399,137.416],[40.45,138.484],[39.501,139.552],[38.552,140.62]],widths770:[9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8],extraRoads771:[],forbiddenZones770:[],geometryReady:true,approvedImageShape772:true});
    Object.assign(MAP_DEFINITIONS_770["star_fish"],{image:"map_star_fish_791.png?v=791-approved-art",imageSize:{w:1254,h:1254},logicalSize:{w:172,h:172},start:{"x":86.0,"y":28.6},goal:{"x":86.0,"y":28.6},safeZones:{"start":{"x0":79.8,"y0":24.1,"x1":92.2,"y1":33.1},"goal":{"x0":79.8,"y0":24.1,"x1":92.2,"y1":33.1}},miniCrop:{"x":10,"y":10,"w":152,"h":146},sectorCuts:[0.17,0.34,0.51,0.68,0.84],sectorNames:["출발 구간","초반 승부처","중반 1","중반 2","후반 승부처","마지막 구간"],route770:[[86.0,28.6],[101.322,45.0],[132.213,48.2],[147.04,61.9],[130.977,77.8],[122.328,100.0],[101.322,95.1],[86.0,111.8],[70.678,95.1],[49.92,100.0],[40.776,77.8],[24.218,61.9],[40.034,48.2],[70.678,45.0],[86.0,28.6]],widths770:[7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6],extraRoads771:[],forbiddenZones770:[],geometryReady:true,approvedImageShape772:true,courseType775:"circuit",finishRule775:"one-lap-gate",lapRequired775:true,lapArmFraction775:.82});
    Object.assign(MAP_DEFINITIONS_770["cliff_hanger"],{image:"map_cliff_hanger_772.png?v=772-approved-art",imageSize:{w:696,h:720},logicalSize:{w:172,h:178},start:{"x":128.703,"y":21.36},goal:{"x":40.924,"y":153.08},safeZones:{"start":{"x0":122.5,"y0":15.16,"x1":134.9,"y1":27.56},"goal":{"x0":34.72,"y0":146.88,"x1":47.12,"y1":159.28}},miniCrop:{"x":0,"y":0,"w":172,"h":178},sectorCuts:[0.17,0.34,0.51,0.68,0.84],sectorNames:["출발 구간","초반 승부처","중반 1","중반 2","후반 승부처","마지막 구간"],route770:[[128.703,21.36],[128.407,22.361],[128.11,23.362],[127.814,24.364],[127.369,25.866],[126.924,27.367],[126.529,28.703],[126.133,30.037],[125.738,31.372],[125.219,32.633],[124.7,33.894],[124.181,35.155],[123.539,36.342],[122.896,37.528],[122.253,38.715],[121.487,39.827],[120.721,40.94],[119.955,42.052],[119.066,43.091],[118.176,44.129],[117.286,45.168],[115.878,46.503],[114.469,47.838],[112.986,48.95],[111.503,50.062],[109.947,50.953],[108.39,51.843],[106.759,52.51],[105.128,53.178],[103.497,53.956],[101.866,54.735],[100.234,55.625],[98.603,56.515],[96.972,57.516],[95.341,58.517],[93.71,59.63],[92.079,60.742],[91.116,61.67],[90.152,62.597],[89.188,63.524],[88.348,64.636],[87.507,65.749],[86.667,66.861],[85.951,68.159],[85.234,69.457],[84.517,70.755],[83.924,72.238],[83.331,73.722],[82.738,75.205],[82.343,76.688],[81.947,78.172],[81.552,79.655],[81.354,81.138],[81.156,82.622],[80.959,84.105],[80.959,85.588],[80.959,87.072],[80.959,88.555],[81.156,90.038],[81.354,91.522],[81.552,93.005],[81.576,94.414],[81.601,95.823],[81.626,97.233],[81.478,98.568],[81.329,99.903],[81.181,101.238],[80.699,103.129],[80.217,105.02],[79.476,106.8],[78.734,108.58],[77.808,110.193],[76.881,111.806],[75.769,113.252],[74.657,114.699],[73.359,115.978],[72.062,117.257],[70.579,118.37],[69.097,119.482],[67.651,120.484],[66.205,121.485],[64.797,122.375],[63.388,123.265],[62.016,124.044],[60.645,124.823],[59.31,125.49],[57.976,126.157],[56.753,127.103],[55.529,128.049],[54.417,129.273],[53.305,130.496],[52.304,131.998],[51.303,133.5],[50.414,135.28],[49.524,137.06],[48.672,138.729],[47.819,140.397],[47.003,141.955],[46.188,143.512],[45.409,144.959],[44.631,146.405],[43.89,147.74],[43.148,149.075],[42.592,150.076],[42.036,151.077],[41.295,152.412],[40.924,153.08]],widths770:[8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3],extraRoads771:[],forbiddenZones770:[],geometryReady:true,approvedImageShape772:true});
    Object.assign(MAP_DEFINITIONS_770["river_cross"],{image:"map_river_cross_772.png?v=772-approved-art",imageSize:{w:696,h:720},logicalSize:{w:172,h:178},start:{"x":123.959,"y":21.36},goal:{"x":48.041,"y":158.42},safeZones:{"start":{"x0":117.76,"y0":15.16,"x1":130.16,"y1":27.56},"goal":{"x0":41.84,"y0":152.22,"x1":54.24,"y1":164.62}},miniCrop:{"x":0,"y":0,"w":172,"h":178},sectorCuts:[0.17,0.34,0.51,0.68,0.84],sectorNames:["출발 구간","초반 승부처","중반 1","중반 2","후반 승부처","마지막 구간"],route770:[[123.959,21.36],[123.069,21.582],[121.29,22.027],[119.955,22.361],[118.621,22.695],[116.841,23.14],[115.062,23.585],[113.172,24.086],[111.281,24.586],[109.947,24.957],[108.612,25.328],[107.278,25.699],[105.869,26.107],[104.46,26.515],[103.052,26.923],[101.569,27.368],[100.086,27.812],[98.603,28.258],[97.121,28.628],[95.638,28.999],[94.155,29.37],[92.672,29.667],[91.19,29.963],[89.707,30.26],[88.224,30.482],[86.741,30.705],[85.259,30.927],[83.776,31.076],[82.293,31.224],[80.81,31.373],[79.377,31.706],[77.944,32.04],[76.51,32.374],[75.126,32.893],[73.743,33.412],[72.359,33.931],[71.024,34.636],[69.69,35.34],[68.355,36.045],[67.07,36.935],[65.785,37.825],[64.5,38.715],[63.388,39.753],[62.276,40.792],[61.164,41.83],[60.225,43.017],[59.286,44.203],[58.347,45.39],[57.58,46.725],[56.814,48.06],[56.048,49.395],[55.455,50.878],[54.862,52.362],[54.269,53.845],[53.874,55.328],[53.478,56.812],[53.083,58.295],[52.885,59.778],[52.687,61.262],[52.49,62.745],[52.49,64.228],[52.49,65.712],[52.49,67.195],[52.687,68.678],[52.885,70.162],[53.083,71.645],[53.503,72.943],[53.923,74.241],[54.343,75.539],[55.307,77.208],[56.271,78.876],[57.568,80.267],[58.866,81.658],[60.497,82.77],[62.128,83.882],[63.907,84.661],[65.686,85.44],[67.614,85.885],[69.541,86.33],[70.925,86.404],[72.309,86.478],[73.693,86.552],[75.176,86.404],[76.659,86.256],[78.141,86.107],[79.575,85.848],[81.008,85.588],[82.441,85.329],[83.825,84.958],[85.209,84.587],[86.593,84.216],[87.928,83.734],[89.262,83.252],[90.597,82.77],[91.882,82.177],[93.167,81.583],[94.452,80.99],[96.268,80.545],[98.084,80.1],[99.79,80.1],[101.495,80.1],[103.089,80.545],[104.683,80.99],[106.166,81.88],[107.648,82.77],[109.057,83.994],[110.466,85.218],[111.355,86.256],[112.245,87.294],[113.134,88.333],[113.975,89.593],[114.815,90.854],[115.655,92.115],[116.446,93.598],[117.237,95.082],[118.028,96.565],[118.645,98.123],[119.263,99.68],[119.881,101.237],[120.326,102.869],[120.771,104.501],[121.216,106.132],[121.487,107.838],[121.759,109.544],[122.031,111.25],[122.13,113.03],[122.229,114.81],[122.328,116.59],[122.253,118.259],[122.179,119.927],[122.105,121.596],[121.858,123.154],[121.611,124.711],[121.364,126.269],[120.944,127.715],[120.524,129.161],[120.103,130.607],[119.51,131.942],[118.917,133.278],[118.324,134.613],[117.558,135.799],[116.792,136.986],[116.026,138.173],[115.087,139.211],[114.148,140.249],[113.209,141.287],[112.097,142.177],[110.984,143.067],[109.872,143.957],[108.587,144.699],[107.302,145.441],[106.017,146.183],[104.683,146.739],[103.348,147.295],[102.014,147.851],[100.63,148.222],[99.246,148.593],[97.862,148.964],[96.429,149.149],[94.995,149.335],[93.562,149.52],[92.079,149.52],[90.597,149.52],[89.114,149.52],[87.606,149.594],[86.099,149.668],[84.591,149.742],[83.059,149.891],[81.527,150.039],[79.995,150.187],[78.438,150.41],[76.881,150.632],[75.324,150.855],[73.743,151.152],[72.161,151.448],[70.579,151.745],[69.072,152.079],[67.564,152.412],[66.057,152.746],[64.624,153.117],[63.19,153.488],[61.757,153.859],[60.398,154.267],[59.039,154.675],[57.679,155.083],[56.394,155.528],[55.109,155.972],[53.824,156.417],[52.378,156.918],[50.933,157.419],[49.969,157.752],[49.005,158.086],[48.041,158.42]],widths770:[10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6],extraRoads771:[],forbiddenZones770:[],geometryReady:true,approvedImageShape772:true});
    Object.assign(MAP_DEFINITIONS_770["industrial_zone"],{image:"map_industrial_zone_772.png?v=772-approved-art",imageSize:{w:696,h:720},logicalSize:{w:172,h:178},start:{"x":126.331,"y":21.36},goal:{"x":56.345,"y":153.08},safeZones:{"start":{"x0":120.13,"y0":15.16,"x1":132.53,"y1":27.56},"goal":{"x0":50.14,"y0":146.88,"x1":62.55,"y1":159.28}},miniCrop:{"x":0,"y":0,"w":172,"h":178},sectorCuts:[0.17,0.34,0.51,0.68,0.84],sectorNames:["출발 구간","초반 승부처","중반 1","중반 2","후반 승부처","마지막 구간"],route770:[[126.331,21.36],[125.293,22.027],[124.255,22.695],[122.871,23.585],[121.487,24.475],[120.103,25.365],[118.423,25.958],[116.743,26.552],[115.062,27.145],[113.085,27.442],[111.108,27.738],[109.131,28.035],[107.574,28.258],[106.017,28.48],[104.46,28.703],[102.903,28.925],[101.272,29.148],[99.641,29.37],[98.01,29.593],[96.379,29.815],[94.971,30.483],[93.562,31.15],[92.153,31.817],[90.745,32.485],[89.559,33.597],[88.372,34.71],[87.186,35.823],[86.0,36.935],[84.962,38.27],[83.924,39.605],[82.886,40.94],[81.848,42.275],[80.959,43.833],[80.069,45.39],[79.179,46.947],[78.29,48.505],[77.005,49.84],[75.72,51.175],[74.434,52.51],[73.051,53.103],[71.667,53.697],[70.283,54.29],[68.8,54.29],[67.317,54.29],[65.834,54.29],[64.253,53.697],[62.671,53.103],[61.09,52.51],[59.607,52.955],[58.124,53.4],[56.641,53.845],[55.603,54.957],[54.566,56.07],[53.528,57.183],[52.49,58.295],[51.822,59.853],[51.155,61.41],[50.488,62.968],[49.821,64.525],[49.583,66.127],[49.346,67.729],[49.109,69.331],[48.872,70.933],[48.634,72.535],[48.931,74.204],[49.228,75.873],[49.524,77.541],[49.821,79.21],[50.71,80.545],[51.6,81.88],[52.49,83.215],[53.379,84.55],[54.714,85.44],[56.048,86.33],[57.383,87.22],[58.717,88.11],[60.497,88.555],[62.276,89.0],[64.055,89.445],[65.834,89.89],[67.54,89.89],[69.245,89.89],[70.95,89.89],[72.655,89.89],[74.286,89.445],[75.917,89.0],[77.548,88.555],[79.179,88.11],[80.736,88.221],[82.293,88.332],[83.85,88.444],[85.407,88.555],[86.89,89.222],[88.372,89.89],[89.855,90.557],[91.338,91.225],[92.598,92.449],[93.859,93.672],[95.119,94.896],[96.379,96.12],[97.21,97.544],[98.04,98.968],[98.87,100.392],[99.701,101.816],[100.531,103.24],[100.828,105.131],[101.124,107.022],[101.421,108.914],[101.717,110.805],[101.361,112.407],[101.006,114.009],[100.65,115.611],[100.294,117.213],[99.938,118.815],[99.048,120.373],[98.159,121.93],[97.269,123.487],[96.379,125.045],[95.045,126.157],[93.71,127.27],[92.376,128.382],[91.041,129.495],[89.484,130.162],[87.928,130.83],[86.371,131.498],[84.814,132.165],[83.034,132.387],[81.255,132.61],[79.476,132.833],[77.697,133.055],[76.14,133.5],[74.583,133.945],[73.026,134.39],[71.469,134.835],[69.69,135.725],[67.91,136.615],[66.131,137.505],[65.019,138.729],[63.907,139.952],[62.795,141.176],[61.683,142.4],[60.793,144.18],[59.903,145.96],[59.014,147.74],[58.124,149.52],[57.234,151.3],[56.345,153.08]],widths770:[9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6],extraRoads771:[],forbiddenZones770:[],geometryReady:true,approvedImageShape772:true});
    for(const m of MAP_POOL_770){if(m.id==="s_map"){m.racingLineMode772="validated-s-map";continue;}const line=generateRacingLine772(m);m.racingSpline770=line;m.globalOptimal770=line;m.racingLineMode772="generated-v7.72";}
  }
  bindMapGeometry771();



// ============================================================
// v7.76 MAP PACK REFRESH — 9 MAP CURATION
// Keep Neon Drift + Star Fish and refresh the rest of the visible map pool.
// Geometry stays on the closest existing playable layouts; this patch focuses
// on the in-game map roster, names, thumbnails, and artwork replacement.
// ============================================================
function applyMapSet776(){
  const keep=["s_map","star_fish","ice_ring","desert_oasis","neon_city","double_hairpin","skyway","cliff_hanger","industrial_zone"];
  const meta={
    s_map:{slot:1,name:"네온 드리프트",en:"Neon Drift",theme:"Blue Neon S Course",tags:["기본","S자","네온"],image:"map_v672_equal_medium_start_goal.png?v=776-neon-drift"},
    star_fish:{slot:2,name:"스타 피쉬",en:"Star Fish",theme:"Tropical Star Island",tags:["기본","별모양","한바퀴"],image:"map_star_fish_791.png?v=791-card"},
    ice_ring:{slot:3,name:"아이스 크라운",en:"Ice Crown",theme:"Frozen Crown Canyon",tags:["기본","M자","아이스"],image:"map_ice_m_776.png?v=793-ice-crown-clean",special:{shortcuts:false,obstacles:false,wideRoad:false,multiRoute:false,verticality:false}},
    desert_oasis:{slot:4,name:"사막 오아시스",en:"Desert Oasis",theme:"Desert Ruins Oasis",tags:["기본","사막","한바퀴"],image:"map_desert_oasis_776.png?v=776-desert-oasis",special:{shortcuts:false,obstacles:false,wideRoad:true,multiRoute:false,verticality:false}},
    neon_city:{slot:5,name:"하트",en:"Heart",theme:"Cherry Blossom Heart",tags:["기본","하트","한바퀴"],image:"map_heart_776.png?v=793-heart-clean",special:{shortcuts:false,obstacles:false,wideRoad:true,multiRoute:false,verticality:false}},
    double_hairpin:{slot:6,name:"블랙홀",en:"Black Hole",theme:"Black Hole Spiral",tags:["고난도","나선","테크니컬"],image:"map_black_hole_776.png?v=776-black-hole",special:{shortcuts:false,obstacles:false,wideRoad:false,multiRoute:false,verticality:false}},
    skyway:{slot:7,name:"스페이스",en:"Space",theme:"Deep Space Narrow Run",tags:["좁은길","직선","우주"],image:"map_space_776.png?v=776-space",special:{shortcuts:false,obstacles:false,wideRoad:false,multiRoute:false,verticality:true}},
    cliff_hanger:{slot:8,name:"클리프 행거",en:"Cliff Hanger",theme:"Frozen Cliff Run",tags:["좁은길","절벽","정밀"],image:"map_cliff_hanger_776.png?v=776-cliff-hanger",special:{shortcuts:false,obstacles:false,wideRoad:false,multiRoute:false,verticality:true}},
    industrial_zone:{slot:9,name:"롤링 스톤",en:"Rolling Stone",theme:"Ancient Ruins Obstacle",tags:["장애물","낙석","회피"],image:"map_rolling_stone_776.png?v=776-rolling-stone",special:{shortcuts:false,obstacles:true,wideRoad:false,multiRoute:false,verticality:false}}
  };
  for(const id of keep){
    const m=MAP_DEFINITIONS_770[id];
    if(!m)continue;
    Object.assign(m,meta[id]);
  }
  MAP_POOL_770.splice(0,MAP_POOL_770.length,...keep.map(id=>MAP_DEFINITIONS_770[id]));
  if(!keep.includes(activeMapId770)){
    activeMapId770="s_map";
    activeMap770=MAP_DEFINITIONS_770.s_map;
  }
}
applyMapSet776();

  const CIRCUIT_MAPS_775=new Set(["star_fish","desert_oasis","neon_city","industrial_zone"]);
  const POINT_TO_POINT_MAPS_775=new Set(["ice_ring","double_hairpin","skyway","cliff_hanger"]);
  const CIRCUIT_CLOSURES_775={"rubber_duck":[[126.3,26.7],[130,42],[132,60],[132,78],[131,96],[127,110],[120,120],[112,125],[103,127],[94,130],[86,136],[78,144],[70,150],[61.1,153.1]],"ice_ring":[[126.3,24.9],[138,34],[145,47],[150,63],[152,82],[151,100],[146,116],[137,129],[124,137],[108,142],[90,145],[73,145],[57.5,142.4]],"desert_oasis":[[100.2,24.9],[116,28],[130,37],[140,50],[145,66],[146,83],[143,99],[137,113],[128,124],[118,134],[110,142],[105,147.7]],"neon_city":[[114.5,23.1],[127,31],[136,44],[141,61],[142,80],[140,99],[135,116],[127,131],[115,141],[101,147],[84,150],[68.2,149.5]],"double_hairpin":[[125.1,24.9],[139,30],[146,43],[149,60],[149,80],[147,99],[143,116],[135,131],[123,141],[108,146],[93,148],[86,147.7]],"star_fish":[[88.4,28.5],[81,33],[75,39],[70,46],[65,53],[60,58],[57.5,58.7]],"industrial_zone":[[126.3,21.4],[138,30],[146,43],[150,59],[151,77],[151,96],[148,113],[141,128],[131,139],[117,146],[100,150],[80,152],[62,153],[56.3,153.1]]};

  function densifyClosure775(points,maxStep=1.45){
    if(!Array.isArray(points)||points.length<2)return [];
    const out=[[+points[0][0],+points[0][1]]];
    for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1],dx=b[0]-a[0],dy=b[1]-a[1];
      const d=Math.hypot(dx,dy),n=Math.max(1,Math.ceil(d/maxStep));
      for(let k=1;k<=n;k++){
        const t=k/n;out.push([a[0]+dx*t,a[1]+dy*t]);
      }
    }
    return out;
  }

  function safeBox775(pt,size=16.5){
    const h=size*.5;
    return {x0:pt[0]-h,y0:pt[1]-h,x1:pt[0]+h,y1:pt[1]+h};
  }

  function adjacentFinish775(start,closure){
    if(!closure?.length)return [start[0],start[1]];
    let remain=4.2;
    for(let i=closure.length-1;i>0;i--){
      const a=closure[i-1],b=closure[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(d>=remain){
        const t=(d-remain)/Math.max(.0001,d);
        return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
      }
      remain-=d;
    }
    return [closure[0][0],closure[0][1]];
  }

  function applyStartFinishRules775(){
    for(const m of MAP_POOL_770){
      if(m.id==="s_map"){
        m.courseType775="point-to-point";
        m.finishRule775="end-gate";
        m.lapRequired775=false;
        continue;
      }
      const oldRoute=(m.route770||[]).map(p=>[p[0],p[1]]);
      const oldWidths=[...(m.widths770||[])];
      if(oldRoute.length<2)continue;

      const yellowStart=[oldRoute[oldRoute.length-1][0],oldRoute[oldRoute.length-1][1]];
      const oldGreen=[oldRoute[0][0],oldRoute[0][1]];
      let newRoute=[...oldRoute].reverse();
      let newWidths=[...oldWidths].reverse();

      if(CIRCUIT_MAPS_775.has(m.id)){
        const raw=CIRCUIT_CLOSURES_775[m.id]||[];
        const finish=adjacentFinish775(yellowStart,raw);
        const closure=densifyClosure775([...raw.slice(0,-1),finish]);
        if(closure.length>1){
          newRoute.push(...closure.slice(1));
          const baseW=oldWidths.length?oldWidths[Math.floor(oldWidths.length*.5)]:10;
          for(let i=1;i<closure.length;i++)newWidths.push(baseW);
        }
        m.start={x:yellowStart[0],y:yellowStart[1]};
        m.goal={x:finish[0],y:finish[1]};
        m.safeZones={start:safeBox775(yellowStart),goal:safeBox775(finish)};
        m.courseType775="circuit";
        m.finishRule775="one-lap-gate";
        m.lapRequired775=true;
        m.lapArmFraction775=.82;
      }else{
        m.start={x:yellowStart[0],y:yellowStart[1]};
        m.goal={x:oldGreen[0],y:oldGreen[1]};
        m.safeZones={start:safeBox775(yellowStart),goal:safeBox775(oldGreen)};
        m.courseType775="point-to-point";
        m.finishRule775="end-gate";
        m.lapRequired775=false;
      }

      m.route770=newRoute;
      m.widths770=newWidths;
      const line=generateRacingLine772(m);
      m.racingSpline770=line;
      m.globalOptimal770=line;
      m.racingLineMode772="generated-v7.76";
    }
  }
  applyStartFinishRules775();


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
      image:"map_star_fish_791.png?v=791-geometry",imageSize:{w:1254,h:1254},
      logicalSize:{w:172,h:172},
      route770:[[86.0,28.6],[101.322,45.0],[132.213,48.2],[147.04,61.9],[130.977,77.8],[122.328,100.0],[101.322,95.1],[86.0,111.8],[70.678,95.1],[49.92,100.0],[40.776,77.8],[24.218,61.9],[40.034,48.2],[70.678,45.0],[86.0,28.6]],widths770:[7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6],
      start:{x:86.0,y:28.6},goal:{x:86.0,y:28.6},
      safeZones:{"start":{"x0":79.8,"y0":24.1,"x1":92.2,"y1":33.1},"goal":{"x0":79.8,"y0":24.1,"x1":92.2,"y1":33.1}},miniCrop:{x:10,y:10,w:152,h:146},
      courseType775:"circuit",finishRule775:"one-lap-gate",lapRequired775:true,
      lapArmFraction775:.82,racingLineMode772:"generated-v7.791"
    });
    set777("ice_ring",{
      image:"map_ice_m_776.png?v=792-geometry",imageSize:{w:1122,h:1402},
      logicalSize:{w:142.451,h:178},
      route770:[[20.377,138.642],[20.314,126.0],[20.314,112.0],[20.314,98.0],[20.314,84.0],[20.314,70.0],[20.55,56.0],[21.3,44.0],[23.4,33.2],[27.6,25.5],[33.6,22.4],[40.2,22.0],[45.5,24.8],[49.1,31.0],[53.0,39.8],[57.5,49.8],[62.3,59.5],[67.0,67.1],[71.099,69.194],[75.2,67.1],[79.9,59.5],[84.7,49.8],[89.2,39.8],[93.1,31.0],[96.7,24.8],[102.0,22.0],[108.6,22.4],[114.6,25.5],[118.8,33.2],[120.9,44.0],[121.65,56.0],[121.95,70.0],[121.95,84.0],[121.95,98.0],[121.946,112.0],[121.946,126.0],[121.946,138.642]],widths770:[16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0],
      start:{x:20.377,y:138.642},goal:{x:121.946,y:138.642},
      safeZones:{"start":{"x0":13.966,"y0":132.294,"x1":26.789,"y1":144.99},"goal":{"x0":115.535,"y0":132.294,"x1":128.358,"y1":144.99}},miniCrop:{x:0,y:0,w:142.451,h:178},
      courseType775:"point-to-point",finishRule775:"end-gate",lapRequired775:false,
      lapArmFraction775:0,racingLineMode772:"generated-v7.792"
    });
    set777("desert_oasis",{
      image:"map_desert_oasis_776.png?v=777-geometry",imageSize:{w:1122,h:1402},
      logicalSize:{w:142.451,h:178},
      route770:[[18.409,60.942],[17.775,82.525],[19.044,105.378],[29.836,130.77],[54.594,138.388],[82.525,138.388],[106.648,132.04],[118.074,114.265],[121.248,88.873],[121.248,63.481],[116.805,41.897],[101.569,26.662],[78.716,21.583],[59.672,26.662],[45.706,36.184],[27.932,38.088],[20.314,45.071],[18.409,60.942]],widths770:[17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0,17.0],
      start:{x:18.409,y:60.942},goal:{x:18.409,y:60.942},
      safeZones:{"start":{"x0":12.908999999999999,"y0":55.442,"x1":23.909,"y1":66.44200000000001},"goal":{"x0":12.908999999999999,"y0":55.442,"x1":23.909,"y1":66.44200000000001}},miniCrop:{x:0,y:0,w:142.451,h:178},
      courseType775:"circuit",finishRule775:"one-lap-gate",lapRequired775:true,
      lapArmFraction775:.82,racingLineMode772:"generated-v7.77"
    });
    set777("neon_city",{
      image:"map_heart_776.png?v=777-geometry",imageSize:{w:1122,h:1402},
      logicalSize:{w:142.451,h:178},
      route770:[[71.099,131.405],[57.133,119.979],[43.167,107.917],[31.106,93.317],[23.488,76.177],[22.853,54.593],[29.836,38.088],[43.167,29.201],[57.133,31.106],[71.099,43.802],[85.064,31.106],[99.03,29.201],[112.361,38.088],[119.344,54.593],[118.709,76.177],[111.091,93.317],[99.03,107.917],[85.064,119.979],[71.099,131.405]],widths770:[16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5,16.5],
      start:{x:71.099,y:131.405},goal:{x:71.099,y:131.405},
      safeZones:{"start":{"x0":65.599,"y0":125.905,"x1":76.599,"y1":136.905},"goal":{"x0":65.599,"y0":125.905,"x1":76.599,"y1":136.905}},miniCrop:{x:0,y:0,w:142.451,h:178},
      courseType775:"circuit",finishRule775:"one-lap-gate",lapRequired775:true,
      lapArmFraction775:.82,racingLineMode772:"generated-v7.77"
    });
    set777("double_hairpin",{
      image:"map_black_hole_776.png?v=777-geometry",imageSize:{w:1122,h:1402},
      logicalSize:{w:142.451,h:178},
      route770:[[32.721,128.013],[25.467,120.68],[19.564,112.346],[15.142,103.251],[12.292,93.653],[11.057,83.819],[11.439,74.017],[13.394,64.507],[16.838,55.537],[21.648,47.337],[27.666,40.108],[34.707,34.024],[42.561,29.223],[50.998,25.806],[59.782,23.834],[68.669,23.328],[77.42,24.268],[85.802,26.597],[93.6,30.222],[100.618,35.014],[106.687,40.818],[111.666,47.454],[115.447,54.725],[117.958,62.421],[119.162,70.323],[119.061,78.216],[117.688,85.886],[115.114,93.134],[111.438,99.775],[106.788,105.647],[101.315,110.611],[95.188,114.559],[88.591,117.411],[81.713,119.12],[74.749,119.673],[67.889,119.086],[61.315,117.409],[55.196,114.718],[49.686,111.116],[44.915,106.728],[40.989,101.696],[37.99,96.178],[35.969,90.337],[34.951,84.343],[34.931,78.363],[35.878,72.561],[37.732,67.088],[40.412,62.084],[43.818,57.667],[47.83,53.939],[52.317,50.977],[57.138,48.836],[62.149,47.542],[67.205,47.101],[72.164,47.492],[76.893,48.671],[81.271,50.575],[85.19,53.121],[88.56,56.213],[91.311,59.74],[93.392,63.586],[94.774,67.63],[95.45,71.748],[95.433,75.82],[94.757,79.735],[93.471,83.389],[91.643,86.69],[89.351,89.561],[86.686,91.943],[83.745,93.791],[80.627,95.083],[77.433,95.81]],widths770:[15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5,15.5],
      start:{x:32.721,y:128.013},goal:{x:77.433,y:95.81},
      safeZones:{"start":{"x0":27.220999999999997,"y0":122.513,"x1":38.221,"y1":133.513},"goal":{"x0":71.933,"y0":90.31,"x1":82.933,"y1":101.31}},miniCrop:{x:0,y:0,w:142.451,h:178},
      courseType775:"point-to-point",finishRule775:"end-gate",lapRequired775:false,
      lapArmFraction775:0,racingLineMode772:"generated-v7.77"
    });
    set777("skyway",{
      image:"map_space_776.png?v=793-wider-corridor",imageSize:{w:724,h:2172},
      logicalSize:{w:59.333,h:178},
      route770:[[29.666,167.182],[29.666,152.431],[29.666,135.221],[29.666,118.011],[29.666,100.801],[29.666,83.591],[29.666,66.381],[29.666,49.171],[29.666,31.961],[29.666,12.703]],widths770:[5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8],
      start:{x:29.666,y:167.182},goal:{x:29.666,y:12.703},
      safeZones:{"start":{"x0":26.416,"y0":163.932,"x1":32.916,"y1":170.432},"goal":{"x0":26.416,"y0":9.453,"x1":32.916,"y1":15.953}},miniCrop:{x:0,y:0,w:59.333,h:178},
      courseType775:"point-to-point",finishRule775:"end-gate",lapRequired775:false,
      lapArmFraction775:0,racingLineMode772:"generated-v7.77"
    });
    set777("cliff_hanger",{
      image:"map_cliff_hanger_776.png?v=777-geometry",imageSize:{w:1086,h:1448},
      logicalSize:{w:133.5,h:178},
      route770:[[27.044,14.137],[36.878,14.137],[47.942,18.439],[57.776,26.43],[68.84,35.035],[84.82,40.566],[102.03,45.483],[116.167,52.859],[121.084,63.923],[120.47,79.903],[117.396,94.655],[110.635,106.948],[100.801,114.323],[88.508,115.552],[79.903,107.562],[70.684,95.884],[61.464,84.82],[51.63,81.133],[41.181,83.591],[31.347,89.738],[25.2,98.343],[25.2,108.177],[30.732,116.167],[39.337,121.084],[40.566,129.075],[36.878,135.221],[42.41,139.523],[54.703,139.523]],widths770:[6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4],
      start:{x:27.044,y:14.137},goal:{x:54.703,y:139.523},
      safeZones:{"start":{"x0":23.794,"y0":10.887,"x1":30.294,"y1":17.387},"goal":{"x0":51.453,"y0":136.273,"x1":57.953,"y1":142.773}},miniCrop:{x:0,y:0,w:133.5,h:178},
      courseType775:"point-to-point",finishRule775:"end-gate",lapRequired775:false,
      lapArmFraction775:0,racingLineMode772:"generated-v7.77"
    });
    set777("industrial_zone",{
      image:"map_rolling_stone_776.png?v=777-geometry",imageSize:{w:1122,h:1402},
      logicalSize:{w:142.451,h:178},
      route770:[[71.099,18.409],[54.594,18.409],[38.089,20.949],[26.662,27.932],[20.949,38.088],[26.027,48.245],[38.089,57.767],[45.071,66.655],[41.897,77.447],[33.01,87.603],[26.027,99.03],[26.662,111.726],[34.914,121.248],[49.515,126.961],[71.099,128.231],[92.682,125.692],[107.917,118.074],[117.44,106.648],[120.614,93.317],[116.805,79.351],[107.917,69.194],[100.3,63.481],[103.474,54.593],[111.726,46.341],[119.979,36.819],[117.44,27.932],[106.648,21.583],[88.873,18.409],[71.099,18.409]],widths770:[16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0,16.0],
      start:{x:71.099,y:18.409},goal:{x:71.099,y:18.409},
      safeZones:{"start":{"x0":65.599,"y0":12.908999999999999,"x1":76.599,"y1":23.909},"goal":{"x0":65.599,"y0":12.908999999999999,"x1":76.599,"y1":23.909}},miniCrop:{x:0,y:0,w:142.451,h:178},
      courseType775:"circuit",finishRule775:"one-lap-gate",lapRequired775:true,
      lapArmFraction775:.82,racingLineMode772:"generated-v7.77"
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
  // v7.793 — Heart / Black Hole / Space targeted tuning
  // 1) Heart: move shared red gate upward and start slightly higher
  // 2) Black Hole: use only the lower start gate and make the normal line
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
      space.image="map_space_776.png?v=793-wider-corridor";
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
  // v7.795 — Cliff Hanger targeted endpoint + strict road follow patch
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
  // v7.796 — Rolling Stone targeted patch
  // 1) Remove the extra 5 small rocks from the artwork and restore a single shared red gate
  // 2) Make the three large boulders non-drivable via forbidden zones
  // 3) Enforce circuit road-follow so 6->3 and 3->1 stay on the paved lane
  // ============================================================
  function applyRollingStonePatch796(){
    const m=MAP_DEFINITIONS_770.industrial_zone;
    if(!m)return;
    m.image="map_rolling_stone_776.png?v=796-road-follow";
    m.start={x:71.099,y:18.409};
    m.goal={x:71.099,y:18.409};
    m.safeZones={
      start:{x0:65.6,y0:12.9,x1:76.6,y1:23.9},
      goal:{x0:65.6,y0:12.9,x1:76.6,y1:23.9}
    };
    m.route770=[[71.099,18.409],[60.0,18.6],[49.0,18.8],[38.089,20.949],[29.5,24.5],[23.5,31.0],[20.7,39.0],[22.5,47.0],[28.0,53.0],[36.0,58.8],[44.2,66.7],[42.0,76.5],[36.2,84.5],[30.2,92.5],[26.5,101.0],[28.0,110.5],[33.0,118.8],[41.5,124.2],[52.5,127.3],[64.0,128.1],[76.0,128.1],[88.0,127.2],[99.0,125.0],[108.0,120.5],[116.0,113.5],[121.0,105.0],[123.0,95.0],[122.5,84.0],[120.0,73.0],[115.5,63.8],[111.0,55.0],[111.5,47.0],[116.0,39.0],[120.2,31.0],[116.0,23.5],[107.0,19.8],[94.5,18.7],[82.5,18.45],[71.099,18.409]];
    m.widths770=[8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8];
    m.forbiddenZones770=[{x1:16.3,y1:28.2,x2:26.8,y2:38.7},{x1:14.0,y1:101.7,x2:25.6,y2:113.9},{x1:109.0,y1:74.8,x2:120.8,y2:86.8}];
    m.sharedGate778=true;
    m.strictRoadFollow778=true;
    m.roadFollowMode778="route-center-hard";
    let line=conservativeRacingLine778(m);
    m.racingSpline770=line;
    m.globalOptimal770=line;
    m.racingLineMode772="generated-v7.796";
  }
  applyRollingStonePatch796();

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
    if(MAP_DEFINITIONS_770.industrial_zone) MAP_DEFINITIONS_770.industrial_zone.hardForbidden780=true;
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
      ice.image="map_ice_m_786.png?v=786-outline-gates";
      ice.gateArtwork786="outline-only";
      ice.edgeFlow785=true;
      ice.stallProofSpline784=true;
    }
  }
  applyGlobalNonSolidEdge786();


  // ============================================================
  // v7.87 — ICE CROWN LOAD FIX + CLEAN ART + BLACK HOLE REVERSE START
  // 1) Ice Crown: stop using the temporary v7.87 asset reference; use the cleaned
  //    v7.87 artwork and keep the existing safe-shortest geometry/racing line.
  // 2) Heart: restore the pre-mosaic original artwork.
  // 3) Black Hole: remove the outer-left start marker from artwork, make the old
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
      heart.image="map_heart_7891_clean.png?v=7893-heart-runtime-fix";
      heart.artworkRestored787=true;
    }

    const black=MAP_DEFINITIONS_770.double_hairpin;
    if(black){
      black.image="map_black_hole_787.png?v=787-inner-right-start";
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
      black.blackHoleReverse787=true;
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
  // v7.88 — BLACK HOLE GATE CORRECTION + SPACE +2 ROAD ROWS
  // ============================================================
  function applyPatch788(){
    const black=MAP_DEFINITIONS_770.double_hairpin;
    if(black){
      // v7.87 had yellow/green roles reversed. Restore the opposite gate roles.
      // Start at the outer-left gate; finish at the inner-right gate.
      black.image="map_black_hole_776.png?v=788-correct-gates";
      let r=(black.route770||[]).map(q=>[q[0],q[1]]);
      // v7.87 reversed the original route. Put it back to outer -> inner.
      if(black.blackHoleReverse787 && r.length>=2) r=r.reverse();
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
      black.blackHoleReverse787=false;
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
      space.image="map_space_788.png?v=788-plus-two-rows";
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
    const m=currentMap770(),info=mapRouteInfo789(m,t.x,t.y);
    if(!info)return t;
    const turn=mapTurn789(m,info.i),half=info.half;
    let lat=info.lat;
    // v7.895 Black Hole: keep every steering mode close to the traced spiral
    // center so adjacent rings are never selected as a "wide" lane.
    if(m.blackHoleCenterOnly895){
      const frac=mode==='EVADE'?.24:mode==='REJOIN'?.14:.08;
      lat=Math.max(-half*frac,Math.min(half*frac,lat));
      const x=info.cx+info.nx*lat,y=info.cy+info.ny*lat;
      return {...t,x,y,kind:(t.kind||'race720')+'-black-center895'};
    }
    if(turn.side){
      let signed=lat*turn.side;
      const outsideFrac=mode==='EVADE'?.72:mode==='REJOIN'?.52:.40;
      const insideFrac=mode==='EVADE'?.90:mode==='REJOIN'?.76:.72;
      signed=Math.max(-half*outsideFrac,Math.min(half*insideFrac,signed));
      lat=signed*turn.side;
    }else{
      const frac=mode==='EVADE'?.80:mode==='REJOIN'?.62:.60;
      lat=Math.max(-half*frac,Math.min(half*frac,lat));
    }
    const x=info.cx+info.nx*lat,y=info.cy+info.ny*lat;
    if(visualRoadMask674(x,y,info.i)&&courseContainsPoint(x,y,0)&&
       !(m.hardForbidden780&&inForbidden96(x,y,0))&&actualRoadChord719(p.x,p.y,x,y))
      return {...t,x,y,kind:(t.kind||'race720')+'-soft789'};
    return t;
  }

  function softOuterRecovery789(p,now){
    const m=currentMap770();
    if(!m.edgePassThrough786)return false;
    // v7.895 Star Fish: crossing the visual rail must never itself trigger
    // a state change. Avoidance can continue through the edge and normal spline
    // recovery will happen from ordinary race-state logic, without a freeze loop.
    if(m.id==='star_fish')return false;
    // One road-edge line plus a small exterior skim remains freely traversable.
    // Only a genuinely large exterior excursion requests a natural REJOIN.
    if(courseContainsPoint(p.x,p.y,1.20))return false;
    const st=ensureRaceState720(p,now);
    if(st.mode!=='REJOIN'){
      st.mode='REJOIN';st.since=now;st.target=null;st.action='none';st.actionUntil=0;
      st.rejoinUntil=now+620+driverExecution720(p).recovery*260;
    }
    p._outerSoftRecoveries789=(p._outerSoftRecoveries789||0)+1;
    return true;
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


  // v7.89 code-audit fix: Rolling Stone's v7.796 center route passed through
  // the three hard boulder rectangles.  That could trap NORMAL racers in a
  // hard-obstacle rollback/rejoin loop.  Restore enough real road width for the
  // narrow side passages and use a prevalidated continuous bypass spline.
  function applyRollingStoneObstacleBypass789(){
    const m=MAP_DEFINITIONS_770.industrial_zone;
    if(!m)return;
    m.widths770=new Array(Math.max(1,(m.route770||[]).length-1)).fill(14.0);
    const line=[[71.099,18.409],[70.405,18.421],[69.712,18.433],[69.018,18.445],[68.324,18.457],[67.631,18.469],[66.937,18.481],[66.243,18.493],[65.549,18.505],[64.856,18.516],[64.162,18.528],[63.468,18.54],[62.775,18.552],[62.081,18.564],[61.387,18.576],[60.694,18.588],[60.0,18.6],[59.312,18.613],[58.625,18.625],[57.938,18.638],[57.25,18.65],[56.562,18.663],[55.875,18.675],[55.188,18.688],[54.5,18.7],[53.812,18.713],[53.125,18.725],[52.438,18.738],[51.75,18.75],[51.062,18.762],[50.375,18.775],[49.688,18.788],[49.0,18.8],[48.318,18.934],[47.636,19.069],[46.954,19.203],[46.272,19.337],[45.59,19.472],[44.908,19.606],[44.226,19.74],[43.544,19.875],[42.863,20.009],[42.181,20.143],[41.499,20.277],[40.817,20.412],[40.135,20.546],[39.453,20.68],[38.771,20.815],[38.089,20.949],[37.475,21.203],[36.862,21.456],[36.248,21.71],[35.635,21.964],[35.021,22.217],[34.408,22.471],[33.794,22.724],[33.181,22.978],[32.567,23.232],[31.954,23.485],[31.34,23.739],[30.975,24.593],[30.61,25.448],[30.455,25.382],[29.994,25.882],[29.532,26.382],[29.071,26.882],[28.609,27.382],[28.148,27.882],[27.686,28.382],[27.702,29.323],[27.718,30.264],[27.734,31.204],[27.75,32.145],[27.766,33.086],[27.305,33.586],[27.795,32.503],[27.579,33.118],[27.364,33.734],[27.762,34.564],[27.547,35.179],[27.331,35.795],[27.729,36.625],[27.514,37.24],[27.912,38.07],[27.697,38.686],[27.481,39.301],[25.425,39.272],[23.369,39.244],[19.432,39.285],[20.216,39.809],[21.0,40.333],[21.15,41.0],[21.3,41.667],[21.45,42.333],[21.6,43.0],[21.75,43.667],[21.9,44.333],[22.05,45.0],[22.2,45.667],[22.35,46.333],[22.5,47.0],[22.958,47.5],[23.417,48.0],[23.875,48.5],[24.333,49.0],[24.792,49.5],[25.25,50.0],[25.708,50.5],[26.167,51.0],[26.625,51.5],[27.083,52.0],[27.542,52.5],[28.0,53.0],[28.533,53.387],[29.067,53.773],[29.6,54.16],[30.133,54.547],[30.667,54.933],[31.2,55.32],[31.733,55.707],[32.267,56.093],[32.8,56.48],[33.333,56.867],[33.867,57.253],[34.4,57.64],[34.933,58.027],[35.467,58.413],[36.0,58.8],[36.482,59.265],[36.965,59.729],[37.447,60.194],[37.929,60.659],[38.412,61.124],[38.894,61.588],[39.376,62.053],[39.859,62.518],[40.341,62.982],[40.824,63.447],[41.306,63.912],[41.788,64.376],[42.271,64.841],[42.753,65.306],[43.235,65.771],[43.718,66.235],[44.2,66.7],[44.053,67.353],[43.907,68.007],[43.76,68.66],[43.613,69.313],[43.467,69.967],[43.32,70.62],[43.173,71.273],[43.027,71.927],[42.88,72.58],[42.733,73.233],[42.587,73.887],[42.44,74.54],[42.293,75.193],[42.147,75.847],[42.0,76.5],[41.613,77.033],[41.227,77.567],[40.84,78.1],[40.453,78.633],[40.067,79.167],[39.68,79.7],[39.293,80.233],[38.907,80.767],[38.52,81.3],[38.133,81.833],[37.747,82.367],[37.36,82.9],[36.973,83.433],[36.587,83.967],[36.2,84.5],[35.8,85.033],[35.4,85.567],[35.0,86.1],[34.6,86.633],[34.2,87.167],[33.8,87.7],[33.4,88.233],[33.0,88.767],[32.6,89.3],[32.2,89.833],[31.8,90.367],[31.4,90.9],[31.0,91.433],[30.6,91.967],[30.2,92.5],[29.936,93.107],[29.671,93.714],[29.407,94.321],[29.143,94.929],[28.879,95.536],[28.614,96.143],[28.35,96.75],[28.086,97.357],[27.821,97.964],[27.557,98.571],[27.293,99.179],[27.029,99.786],[26.764,100.393],[26.5,101.0],[26.607,101.679],[26.714,102.357],[26.821,103.036],[26.929,103.714],[27.036,104.393],[27.143,105.071],[27.25,105.75],[27.357,106.429],[27.464,107.107],[27.571,107.786],[27.679,108.464],[27.786,109.143],[27.893,109.821],[28.0,110.5],[28.357,111.093],[28.714,111.686],[29.071,112.279],[29.429,112.871],[29.786,113.464],[30.143,114.057],[30.5,114.65],[30.857,115.243],[31.214,115.836],[31.571,116.429],[31.929,117.021],[32.286,117.614],[32.643,118.207],[33.0,118.8],[33.567,119.16],[34.133,119.52],[34.7,119.88],[35.267,120.24],[35.833,120.6],[36.4,120.96],[36.967,121.32],[37.533,121.68],[38.1,122.04],[38.667,122.4],[39.233,122.76],[39.8,123.12],[40.367,123.48],[40.933,123.84],[41.5,124.2],[42.147,124.382],[42.794,124.565],[43.441,124.747],[44.088,124.929],[44.735,125.112],[45.382,125.294],[46.029,125.476],[46.676,125.659],[47.324,125.841],[47.971,126.024],[48.618,126.206],[49.265,126.388],[49.912,126.571],[50.559,126.753],[51.206,126.935],[51.853,127.118],[52.5,127.3],[53.176,127.347],[53.853,127.394],[54.529,127.441],[55.206,127.488],[55.882,127.535],[56.559,127.582],[57.235,127.629],[57.912,127.676],[58.588,127.724],[59.265,127.771],[59.941,127.818],[60.618,127.865],[61.294,127.912],[61.971,127.959],[62.647,128.006],[63.324,128.053],[64.0,128.1],[64.667,128.1],[65.333,128.1],[66.0,128.1],[66.667,128.1],[67.333,128.1],[68.0,128.1],[68.667,128.1],[69.333,128.1],[70.0,128.1],[70.667,128.1],[71.333,128.1],[72.0,128.1],[72.667,128.1],[73.333,128.1],[74.0,128.1],[74.667,128.1],[75.333,128.1],[76.0,128.1],[76.667,128.05],[77.333,128.0],[78.0,127.95],[78.667,127.9],[79.333,127.85],[80.0,127.8],[80.667,127.75],[81.333,127.7],[82.0,127.65],[82.667,127.6],[83.333,127.55],[84.0,127.5],[84.667,127.45],[85.333,127.4],[86.0,127.35],[86.667,127.3],[87.333,127.25],[88.0,127.2],[88.647,127.071],[89.294,126.941],[89.941,126.812],[90.588,126.682],[91.235,126.553],[91.882,126.424],[92.529,126.294],[93.176,126.165],[93.824,126.035],[94.471,125.906],[95.118,125.776],[95.765,125.647],[96.412,125.518],[97.059,125.388],[97.706,125.259],[98.353,125.129],[99.0,125.0],[99.6,124.7],[100.2,124.4],[100.8,124.1],[101.4,123.8],[102.0,123.5],[102.6,123.2],[103.2,122.9],[103.8,122.6],[104.4,122.3],[105.0,122.0],[105.6,121.7],[106.2,121.4],[106.8,121.1],[107.4,120.8],[108.0,120.5],[108.5,120.062],[109.0,119.625],[109.5,119.188],[110.0,118.75],[110.5,118.312],[111.0,117.875],[111.5,117.438],[112.0,117.0],[112.5,116.562],[113.0,116.125],[113.5,115.688],[114.0,115.25],[114.5,114.812],[115.0,114.375],[115.5,113.938],[116.0,113.5],[116.333,112.933],[116.667,112.367],[117.0,111.8],[117.333,111.233],[117.667,110.667],[118.0,110.1],[118.333,109.533],[118.667,108.967],[119.0,108.4],[119.333,107.833],[119.667,107.267],[120.0,106.7],[120.333,106.133],[120.667,105.567],[121.0,105.0],[121.133,104.333],[121.267,103.667],[121.4,103.0],[121.533,102.333],[121.667,101.667],[121.8,101.0],[121.933,100.333],[122.067,99.667],[122.2,99.0],[122.333,98.333],[122.467,97.667],[122.6,97.0],[122.733,96.333],[122.867,95.667],[123.0,95.0],[122.969,94.312],[122.938,93.625],[122.906,92.938],[122.875,92.25],[122.844,91.562],[122.812,90.875],[122.781,90.188],[122.75,89.5],[122.719,88.812],[122.688,88.125],[122.656,87.438],[122.625,86.75],[122.594,86.062],[122.562,85.375],[122.531,84.688],[122.5,84.0],[122.353,83.353],[122.206,82.706],[122.059,82.059],[121.912,81.412],[121.765,80.765],[121.618,80.118],[121.471,79.471],[121.324,78.824],[121.81,78.032],[121.663,77.385],[121.516,76.738],[121.369,76.091],[121.856,75.3],[121.709,74.653],[121.562,74.006],[120.781,73.503],[120.0,73.0],[119.7,72.387],[119.4,71.773],[119.1,71.16],[118.8,70.547],[118.5,69.933],[118.2,69.32],[117.9,68.707],[117.6,68.093],[117.3,67.48],[117.0,66.867],[116.7,66.253],[116.4,65.64],[116.1,65.027],[115.8,64.413],[115.5,63.8],[115.2,63.213],[114.9,62.627],[114.6,62.04],[114.3,61.453],[114.0,60.867],[113.7,60.28],[113.4,59.693],[113.1,59.107],[112.8,58.52],[112.5,57.933],[112.2,57.347],[111.9,56.76],[111.6,56.173],[111.3,55.587],[111.0,55.0],[111.042,54.333],[111.083,53.667],[111.125,53.0],[111.167,52.333],[111.208,51.667],[111.25,51.0],[111.292,50.333],[111.333,49.667],[111.375,49.0],[111.417,48.333],[111.458,47.667],[111.5,47.0],[111.821,46.429],[112.143,45.857],[112.464,45.286],[112.786,44.714],[113.107,44.143],[113.429,43.571],[113.75,43.0],[114.071,42.429],[114.393,41.857],[114.714,41.286],[115.036,40.714],[115.357,40.143],[115.679,39.571],[116.0,39.0],[116.323,38.385],[116.646,37.769],[116.969,37.154],[117.292,36.538],[117.615,35.923],[117.938,35.308],[118.262,34.692],[118.585,34.077],[118.908,33.462],[119.231,32.846],[119.554,32.231],[119.877,31.615],[119.633,31.318],[119.31,30.741],[118.987,30.164],[118.664,29.587],[118.341,29.01],[118.017,28.433],[117.694,27.856],[117.371,27.279],[117.048,26.702],[116.725,26.125],[116.402,25.548],[116.079,24.971],[115.756,24.395],[115.753,24.101],[115.357,23.236],[114.714,22.971],[114.071,22.707],[113.429,22.443],[112.786,22.179],[112.143,21.914],[111.5,21.65],[110.857,21.386],[110.214,21.121],[109.571,20.857],[108.929,20.593],[108.286,20.329],[107.643,20.064],[107.0,19.8],[106.306,19.739],[105.611,19.678],[104.917,19.617],[104.222,19.556],[103.528,19.494],[102.833,19.433],[102.139,19.372],[101.444,19.311],[100.75,19.25],[100.056,19.189],[99.361,19.128],[98.667,19.067],[97.972,19.006],[97.278,18.944],[96.583,18.883],[95.889,18.822],[95.194,18.761],[94.5,18.7],[93.833,18.686],[93.167,18.672],[92.5,18.658],[91.833,18.644],[91.167,18.631],[90.5,18.617],[89.833,18.603],[89.167,18.589],[88.5,18.575],[87.833,18.561],[87.167,18.547],[86.5,18.533],[85.833,18.519],[85.167,18.506],[84.5,18.492],[83.833,18.478],[83.167,18.464],[82.5,18.45],[81.829,18.448],[81.159,18.445],[80.488,18.443],[79.817,18.44],[79.147,18.438],[78.476,18.436],[77.805,18.433],[77.135,18.431],[76.464,18.428],[75.794,18.426],[75.123,18.423],[74.452,18.421],[73.782,18.419],[73.111,18.416],[72.44,18.414],[71.77,18.411],[71.099,18.409]];
    m.racingSpline770=line;
    m.globalOptimal770=line;
    m.racingLineMode772='boulder-bypass-v7.89';
    m.boulderBypass789=true;
    m.insideTune789='boulder-bypass+runtime-bias';
  }
  applyRollingStoneObstacleBypass789();


  // ============================================================
  // v7.892 — BLACK HOLE TRUE OUTER-TO-INNER SPIRAL
  // - Remove the duplicate LEFT runtime yellow gate by aligning START to the
  //   single yellow artwork gate immediately to its right.
  // - Start moves RIGHT along the bottom road (7 -> 5), then winds through
  //   5 -> 1 -> 11 -> 9 repeatedly, shrinking inward to the central green gate.
  // - Do not reuse the old route whose first target pulled units straight upward.
  // ============================================================
  function applyPatch7892(){
    const black=MAP_DEFINITIONS_770.double_hairpin;
    if(!black)return;
    black.image="map_black_hole_776.png?v=7892-single-yellow-spiral";
    black.route770=[[20.007,149.93],[21.187,149.973],[23.44,150.037],[26.821,150.132],[31.328,150.259],[36.136,150.354],[41.247,150.418],[46.658,150.449],[52.372,150.449],[58.006,150.251],[63.56,149.854],[69.035,149.259],[74.431,148.466],[79.589,147.394],[84.509,146.045],[89.191,144.419],[93.634,142.514],[97.84,140.372],[101.807,137.991],[105.537,135.373],[109.028,132.516],[112.321,129.263],[115.416,125.613],[118.312,121.566],[121.01,117.122],[123.431,112.44],[125.573,107.521],[127.438,102.363],[129.025,96.967],[130.215,91.571],[131.009,86.175],[131.405,80.779],[131.405,75.383],[130.969,70.027],[130.096,64.711],[128.787,59.434],[127.041,54.197],[124.859,49.317],[122.24,44.794],[119.185,40.628],[115.694,36.819],[111.885,33.486],[107.759,30.629],[103.315,28.249],[98.554,26.345],[93.634,24.797],[88.556,23.607],[83.319,22.774],[77.923,22.298],[72.606,22.258],[67.369,22.655],[62.211,23.488],[57.133,24.757],[52.292,26.345],[47.69,28.249],[43.326,30.471],[39.199,33.01],[35.391,35.787],[31.899,38.803],[28.725,42.056],[25.868,45.547],[23.329,49.198],[21.107,53.006],[19.203,56.974],[17.616,61.1],[16.307,65.226],[15.275,69.353],[14.521,73.479],[14.045,77.605],[13.886,81.731],[14.045,85.858],[14.521,89.984],[15.315,94.11],[16.346,97.998],[17.616,101.649],[19.124,105.061],[20.869,108.235],[22.774,111.091],[24.837,113.631],[27.059,115.852],[29.439,117.757],[32.256,119.463],[35.51,120.97],[39.199,122.28],[43.326,123.391],[47.69,124.303],[52.292,125.017],[57.133,125.533],[62.211,125.851],[67.131,125.89],[71.892,125.652],[76.494,125.136],[80.938,124.343],[85.223,123.192],[89.349,121.685],[93.317,119.82],[97.126,117.598],[100.577,115.059],[103.672,112.202],[106.41,109.028],[108.79,105.537],[110.853,101.807],[112.599,97.84],[114.027,93.634],[115.138,89.19],[115.813,84.905],[116.051,80.779],[115.853,76.812],[115.218,73.003],[114.186,69.392],[112.758,65.98],[110.933,62.767],[108.711,59.751],[106.172,57.053],[103.315,54.673],[100.141,52.61],[96.65,50.864],[93.079,49.396],[89.429,48.206],[85.699,47.293],[81.89,46.658],[78.081,46.301],[74.273,46.222],[70.464,46.42],[66.655,46.896],[63.084,47.69],[59.751,48.801],[56.657,50.229],[53.8,51.975],[51.181,53.919],[48.801,56.061],[46.658,58.402],[44.754,60.942],[43.088,63.639],[41.659,66.496],[40.469,69.511],[39.517,72.685],[38.882,75.82],[38.565,78.914],[38.565,81.97],[38.882,84.985],[39.517,87.921],[40.469,90.777],[41.739,93.555],[43.326,96.253],[45.27,98.752],[47.571,101.053],[50.229,103.156],[53.245,105.061],[56.339,106.687],[59.513,108.036],[62.767,109.108],[66.099,109.901],[69.392,110.417],[72.646,110.655],[75.86,110.615],[79.034,110.298],[82.009,109.742],[84.787,108.949],[87.366,107.917],[89.746,106.648],[91.928,105.18],[93.912,103.513],[95.697,101.649],[97.284,99.585],[98.673,97.403],[99.863,95.102],[100.855,92.682],[101.649,90.143],[102.164,87.603],[102.403,85.064],[102.363,82.525],[102.045,79.986],[101.49,77.526],[100.696,75.145],[99.665,72.844],[98.395,70.622],[96.967,68.559],[95.38,66.655],[93.634,64.909],[91.73,63.322],[89.706,61.933],[87.564,60.743],[85.302,59.751],[82.922,58.958],[80.541,58.442],[78.161,58.204],[75.78,58.244],[73.4,58.561],[71.138,59.116],[68.996,59.91],[66.972,60.942],[65.068,62.211],[63.401,63.639],[61.973,65.226],[60.783,66.972],[59.831,68.877],[59.077,70.821],[58.521,72.804],[58.164,74.828],[58.006,76.891],[58.085,78.914],[58.402,80.898],[58.958,82.842],[59.751,84.747],[60.783,86.493],[62.053,88.08],[63.56,89.508],[65.306,90.777],[67.052,91.888],[68.797,92.841],[70.543,93.634],[72.289,94.269],[73.836,94.769],[75.185,95.134],[76.336,95.364],[77.288,95.459],[78.002,95.531],[78.478,95.578],[78.738,95.661]];
    black.widths770=[13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5,13.5];
    black.start={x:20.007,y:149.93};
    black.goal={x:78.738,y:95.661};
    // Match the baked artwork boxes so a second adjacent runtime box is not drawn.
    black.safeZones={
      start:{x0:13.458,y0:144.101,x1:27.043,y1:156.036},
      goal:{x0:74.019,y0:90.650,x1:83.541,y1:100.807}
    };
    black.courseType775="point-to-point";
    black.finishRule775="end-gate";
    black.lapRequired775=false;
    black.sharedGate778=false;
    black.strictRoadFollow778=true;
    black.roadFollowMode778="route-center-hard";
    black.blackHoleReverse787=false;
    black.startDirection788="right-along-bottom-road";
    black.startDirection892="right";
    black.spiralDirection892="7->5->1->11->9->inward";
    black.leftDuplicateGateRemoved892=true;
    const line=conservativeRacingLine778(black);
    black.racingSpline770=line;
    black.globalOptimal770=line;
    black.racingLineMode772="outer-to-inner-spiral-v7.892";
    black.insideTune789="slight-inside-no-wide-outside+spiral-v7.892";
    black.outerSoftLimit789=true;
  }
  applyPatch7892();


  // ============================================================
  // v7.893 — Mosaic cleanup + Heart runtime refresh + tighter Black Hole line
  // 1) Use the clean Heart/Ice artwork for thumbnails and runtime so leftover
  //    gray mosaic/checker patches are gone.
  // 2) Reaffirm the Heart shared red gate runtime setup with the clean asset.
  // 3) Pull Black Hole's normal racing line slightly inward so it does not
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
      heart.image="map_heart_7891_clean.png?v=7893-heart-runtime-fix";
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
      black.blackHoleLaneTight893=true;
    }
  }
  applyPatch7893();


  // ============================================================
  // v7.894 — Star Fish stall guard + Black Hole single yellow gate + Desert cleanup
  // 1) Star Fish: use a safer, more center-biased authoritative racing spline and
  //    a slightly wider legal ribbon so touching the visual wall no longer makes
  //    racers appear to stall or pin in place.
  // 2) Black Hole: refresh the runtime artwork to the fully single-yellow version.
  // 3) Desert Oasis: refresh the cleaned artwork so the start-side mosaic is gone.
  // ============================================================
  function applyPatch7894(){
    const star=MAP_DEFINITIONS_770.star_fish;
    if(star){
      star.image="map_star_fish_791.png?v=791-approved-art";
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
      black.image="map_black_hole_776.png?v=7894-single-yellow-clean";
      black.leftDuplicateGateRemoved892=true;
      black.blackHoleSingleYellow894=true;
    }

    const desert=MAP_DEFINITIONS_770.desert_oasis;
    if(desert){
      desert.image="map_desert_oasis_776.png?v=7894-start-mosaic-clean";
      desert.desertStartClean894=true;
    }
  }
  applyPatch7894();


  // ============================================================
  // v7.895 — STAR FISH TRUE PASS-THROUGH + BLACK HOLE CENTERLINE LOCK
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
      black.blackHoleCenterOnly895=true;
      black.racingLineMode772="spiral-road-center-v7.895";
      black.insideTune789="centerline-only-v7.895";
      black.outerSoftLimit789=true;
    }
  }
  applyPatch7895();


  function enforceHardForbidden780(p,oldX,oldY){
    const m=currentMap770();
    if(!m.hardForbidden780 || !inForbidden96(p.x,p.y,0))return false;
    // Reject only the current simulation step. This is not a long-distance snap.
    p.x=oldX; p.y=oldY;
    p.desiredOffset=(p.desiredOffset||0)*.20;
    if(p._raceState720){
      p._raceState720.mode="REJOIN";
      p._raceState720.action="none";
      p._raceState720.actionUntil=0;
    }
    p._hardObstacleBlocks780=(p._hardObstacleBlocks780||0)+1;
    return true;
  }

  function mapLapRule775(m=currentMap770()){
    return {
      type:m.courseType775||"point-to-point",
      lapRequired:!!m.lapRequired775,
      armFraction:m.lapArmFraction775||0,
      finishRule:m.finishRule775||"end-gate"
    };
  }

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

  function splineCurvature720(progress){
    const a=splinePointAt720(Math.max(0,progress-1.10));
    const b=splinePointAt720(Math.min(RACING_SPLINE_SEGS_720.total,progress+1.10));
    const dot=Math.max(-1,Math.min(1,a.ux*b.ux+a.uy*b.uy));
    return Math.acos(dot)/2.20;
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

  function advanceOnSpline720(p,distance){
    if(!p || !(distance>0)) return false;
    let prog=Number.isFinite(p._splineProg720)?p._splineProg720:nearestSplineProgress720(p.x,p.y);
    prog=Math.min(RACING_SPLINE_SEGS_720.total,prog+distance);

    const raw=splinePointAt720(prog);
    const q=executedSplinePoint720(p,prog);
    let off=Number(q.executionOffset720)||0;

    // v7.54: the final top straight could flip "wideSide" from one frame to the
    // other or fall from a legal offset to zero. Smooth only the execution offset;
    // forward spline progress remains exact and monotonic.
    const prev=Number.isFinite(p._lineOffset720)?p._lineOffset720:off;
    const maxOffStep=Math.max(.035,Math.min(.095,distance*.31));
    off=prev+Math.max(-maxOffStep,Math.min(maxOffStep,off-prev));

    // Extra hysteresis on the 11 -> 1 o'clock upper straight.
    const topStraight754=currentMap770().id==="s_map"&&raw.x>=57.0&&raw.y<=33.0&&raw.y>=15.0;
    if(topStraight754){
      if(!Number.isFinite(p._topOffsetSign754)||Math.abs(prev)<.025)
        p._topOffsetSign754=Math.sign(off)||Math.sign(prev)||1;
      if(Math.sign(off)&&Math.sign(off)!==p._topOffsetSign754&&Math.abs(off)>.035)
        off=p._topOffsetSign754*Math.min(Math.abs(off),Math.abs(prev)+maxOffStep);
    }

    const nx=-raw.uy,ny=raw.ux;
    let x=raw.x+nx*off,y=raw.y+ny*off;
    if(!visualRoadMask674(x,y,0)||!courseContainsPoint(x,y,0)){
      // Blend toward center instead of snapping straight to zero offset.
      let found=false;
      for(const k of [.80,.60,.40,.20,0]){
        const oo=off*k,xx=raw.x+nx*oo,yy=raw.y+ny*oo;
        if(visualRoadMask674(xx,yy,0)&&courseContainsPoint(xx,yy,0)){
          off=oo;x=xx;y=yy;found=true;break;
        }
      }
      if(!found){x=raw.x;y=raw.y;off=0;}
    }

    p.x=x;p.y=y;p._splineProg720=prog;
    p._splineFloor754=Math.max(Number(p._splineFloor754)||0,prog);
    p._lineOffset720=off;
    return true;
  }

  function syncEvadeSplineProgress754(p,fromX,fromY){
    if(!p)return;
    const old=Number.isFinite(p._splineProg720)?p._splineProg720:
      nearestSplineProgress720(fromX,fromY);
    const projected=nearestSplineProgressLocal734(p.x,p.y,old,48);
    const moved=Math.hypot(p.x-fromX,p.y-fromY);
    const maxForward=old+Math.max(.18,moved*1.55+.12);
    const floor=Math.max(Number(p._splineFloor754)||0,old);
    const next=Math.max(floor,Math.min(projected,maxForward));
    p._splineProg720=Math.min(RACING_SPLINE_SEGS_720.total,next);
    p._splineFloor754=Math.max(floor,p._splineProg720);
  }

  function noTeleportGuard754(p,fromX,fromY,expectedMove,action){
    if(!p)return false;
    const dx=p.x-fromX,dy=p.y-fromY,d=Math.hypot(dx,dy);
    const allow=Math.max(.90,Math.abs(expectedMove)*2.30+.20);
    if(d<=allow||/back/.test(action||""))return false;
    const mode754=p._raceState720?.mode||"NORMAL";
    const normalGuard754=mode754==="NORMAL"&&!/back/.test(action||"");
    const safeAllow754=normalGuard754
      ? Math.max(.42,Math.abs(expectedMove)*1.60+.08)
      : allow;
    const L=d||1;
    const attemptedX754=p.x,attemptedY754=p.y;
    const beforeProg754=Number(p._splineProg720)||0;
    p.x=fromX+dx/L*safeAllow754;
    p.y=fromY+dy/L*safeAllow754;
    p._teleportGuardTrips754=(p._teleportGuardTrips754||0)+1;
    if(!Array.isArray(p._teleportEvents754))p._teleportEvents754=[];
    p._teleportEvents754.push({
      fromX:+fromX.toFixed(3),fromY:+fromY.toFixed(3),
      attemptedX:+attemptedX754.toFixed(3),attemptedY:+attemptedY754.toFixed(3),
      distance:+d.toFixed(3),allow:+safeAllow754.toFixed(3),
      action:String(action||"none"),mode:mode754,
      prog:+beforeProg754.toFixed(3)
    });
    if(p._teleportEvents754.length>12)p._teleportEvents754.shift();
    if(normalGuard754){
      // Bookkeeping repair only: physical position never moves backward.
      // Full projection runs only when the guard trips, so it has negligible cost.
      const repaired=nearestSplineProgress720(p.x,p.y);
      p._splineProg720=repaired;
      p._splineFloor754=repaired;
      p._splineRepair770=(p._splineRepair770||0)+1;
    }else{
      syncEvadeSplineProgress754(p,fromX,fromY);
    }
    return true;
  }

  function splineDeviation720(p){
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

  function predictiveThreat722(p,now){
    if(!p || safeAt(p.x,p.y)) return null;

    const prog=Number.isFinite(p._splineProg720)
      ? p._splineProg720
      : nearestSplineProgress720(p.x,p.y);
    const frame=splinePointAt720(prog);
    const pv=Math.max(6.5,Number(p.speed)||9.72);
    const pvx=frame.ux*pv,pvy=frame.uy*pv;

    // Cheap emergency pass every frame: only observers within 4.0.
    const close=localObservers723(p,4.0);
    for(const o of close){
      const ox=o.x-p.x,oy=o.y-p.y,dist=Math.hypot(ox,oy);
      const forward=ox*frame.ux+oy*frame.uy;
      const lateral=ox*(-frame.uy)+oy*frame.ux;
      if(dist<2.35 || (forward>-.25&&forward<3.55&&Math.abs(lateral)<1.95)){
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
    p._nextThreatScan724=now+44;

    let best=null,bestScore=Infinity;
    const nearby=localObservers723(p,11.1);

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

      const frontBlock=forward>-.25 && forward<4.55 && Math.abs(lateral)<2.05;
      const emergency=
        dist<2.45 ||
        (frontBlock && dist<3.75) ||
        (minSep<1.48 && minH<.31) ||
        (t<.16 && miss<1.90);

      const credible=
        emergency ||
        (minSep<2.72 && minH<.68 && dist<10.2) ||
        (t<.68 && miss<2.72 && dist<9.6);

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
      if(raw.dist<1.20){
        if(st.pendingThreatId!==id){st._detectedAt749=now;noteThreatRead749(p,now);}
        st.pendingThreatId=id;st.reactionReadyAt=now;return raw;
      }
      if(st.pendingThreatId!==id){
        st.pendingThreatId=id;
        st._detectedAt749=now;
        noteThreatRead749(p,now);
        const clutch759=clutchContext759(p);
        const emergencyDelay=10+(1-ex.reaction)*86+(1-ex.focus)*24+
          (1-ex.hand+clutch759.executionPenalty)*26;
        st.reactionReadyAt=now+emergencyDelay;
      }
      if(now<st.reactionReadyAt)return null;
      return raw;
    }

    // Detector stays capped at 11.1. Skill changes interpretation, not omniscience.
    const horizon=.30+ex.awareness*.62;
    const maxReadDist=6.55+ex.awareness*4.20;
    if(eta>horizon || raw.dist>maxReadDist)return null;

    const roundKey=(typeof currentRound==="number"?currentRound:0);
    const h=((p.index+1)*37+(id+3)*17+(roundKey+5)*13)%100/100;
    const readChance=.08+ex.awareness*.72+ex.mental*.12;
    if(h>readChance)return null;

    if(st.pendingThreatId!==id){
      st.pendingThreatId=id;
      st._detectedAt749=now;
      noteThreatRead749(p,now);
      const urgency=clamp01720((.52-eta)/.52);
      const clutch759=clutchContext759(p);
      const delay=(132-ex.reaction*88-ex.focus*20-
        Math.max(0,ex.hand-clutch759.executionPenalty)*12)*(1-urgency*.58);
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
    const oldProg=Number.isFinite(p._splineProg720)?p._splineProg720:0;
    const projected=nearestSplineProgressLocal734(p.x,p.y,oldProg,28);
    const prog=Math.max(oldProg,projected);
    const frame=splinePointAt720(prog);
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
    const ex=driverExecution720(p);
    const old=Number.isFinite(p._splineProg720)?p._splineProg720:0;
    const projected=nearestSplineProgressLocal734(p.x,p.y,old,36);
    const base=Math.max(old,Number(p._splineFloor754)||0,projected);
    const look=4.0+ex.rejoinSkill*2.8;
    for(let d=look;d>=2.2;d-=.35){
      const q=executedSplinePoint720(p,Math.min(RACING_SPLINE_SEGS_720.total,base+d));
      const t={x:q.x,y:q.y,kind:"race720-rejoin"};
      if(actualRoadTarget719(p,p.seg||0,t))return t;
    }
    const q=executedSplinePoint720(p,base);
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

  function speedMultiplier720(p,now,dt=16){
    const st=ensureRaceState720(p,now),ex=driverExecution720(p);
    const unit764=unitChassis764();
    let target=1;

    if(st.mode==="EVADE"){
      if(/back/.test(st.action)){
        target=.54+.10*ex.hand;
        if(!Number.isFinite(p._speedMul720))p._speedMul720=target;
        const alphaBack=1-Math.exp(-Math.max(1,dt)/
          ((60-ex.control*18)/Math.max(.90,unit764.brake)));
        p._speedMul720+=(target-p._speedMul720)*alphaBack;
        return p._speedMul720;
      }
      if(/stop/.test(st.action))target=.16+.05*ex.braking;
      else if(/brake/.test(st.action))target=.40+.20*ex.braking+.06*ex.control;
      else target=.84+.11*ex.hand;
    }else if(st.mode==="REJOIN"){
      target=.88+.11*ex.rejoinSkill;
    }else{
      const prog=Number.isFinite(p._splineProg720)?p._splineProg720:nearestSplineProgress720(p.x,p.y);
      const curve=Math.min(1,splineCurvature720(prog)*4.0);
      const fit769=unitCompatibility769(p);
      const cornerAuthority=unit764.cornerGrip*fit769.cornerMul;
      const cornerLoss=(.068-.050*ex.cornerSkill)/Math.max(.94,cornerAuthority);
      target=1-curve*cornerLoss;
      const raceFrac=Math.max(0,Math.min(1,prog/Math.max(1,RACING_SPLINE_SEGS_720.total)));
      target*=1-raceFrac*Math.max(0,.018*(.70-ex.endurance));
      const luckPhase=((p.index+1)*17+(currentRound||1)*13)%101/100;
      target*=1+(luckPhase-.5)*(ex.luck-.5)*.004;
    }

    // v7.61: raw chassis speed gap is intentionally tiny.
    // This multiplies the player's stat-derived pace; it never replaces it.
    if(target>.20)target*=unit764.topSpeed;

    if(!Number.isFinite(p._speedMul720))p._speedMul720=target;
    const accelTau=78-ex.acceleration*31;
    const rising=target>p._speedMul720+.002;
    let tau;
    if(st.mode==="NORMAL"){
      tau=Math.max(86,142-ex.consistency*22);
      if(rising)tau/=unit764.accel;
    }else if(st.mode==="EVADE"){
      // v7.63: braking response and escape re-acceleration are separate.
      tau=Math.max(22,38-ex.control*10);
      const fit769=unitCompatibility769(p);
      tau/=rising?(unit764.reaccel*fit769.reaccelMul):unit764.brake;
    }else{
      tau=Math.max(38,accelTau);
      const fit769=unitCompatibility769(p);
      tau/=rising?(unit764.reaccel*fit769.reaccelMul):unit764.brake;
    }
    const alpha=1-Math.exp(-Math.max(1,dt)/Math.max(18,tau));
    p._speedMul720 += (target-p._speedMul720)*alpha;
    p._unitSpeedTarget764=target;
    return p._speedMul720;
  }

  
  // v7.24 removed dead legacy AI: raceEngine1019


  
  // v7.24 removed dead legacy AI: raceEngine1000


  
  // v7.24 removed dead legacy AI: raceEngine999


  function raceAI769(p,si,now){
    return raceEngine720(p,si,now);
  }

  function auditedRaceTarget636(p,si,now){
    return raceAI769(p,si,now);
  }

  function racingLine529(p,si,now){
    const t=auditedRaceTarget636(p,si,now);
    return t?{...t,kind:(t.kind||"race720")+"-636"}:null;
  }

function updatePlayer(p, now, dt){
    if(p.done || p.dead) return;
    p.simPrevX=p.x; p.simPrevY=p.y;

    // v2.29 start reaction: milliseconds matter without changing base pace.
    if(raceStart && now-raceStart<p.startReactionMs) return;

    if(now < p.stunUntil){
      p.continuousRunMs=0;p.continuousRunMul=1;
      return;
    }
    if(p.stunUntil){
      p.stunUntil=0;
      p.invUntil=now+INV_MS;
      p.lastAdvanceAt=now;
      p.lastProgress=currentProgress(p);
      const recovery=driverSkill739(p).recovery;
      p.resumeEaseUntil=now+(520-recovery*230);
    }

    p.controlMode="normal"; // v7.24 final AI owns control

    // v2.60 collision-free confidence: grows over ~12s, resets only on actual observer hit.
    p.cleanConfidenceMs=Math.min(12000,(p.cleanConfidenceMs||0)+dt);
    p.cleanConfidence=Math.max(0,Math.min(1,p.cleanConfidenceMs/12000));

    const si=Math.min(p.seg,segs.length-1);
    const s=segs[si];
    const half=widths[si]*0.72;

    // v5.08: final-straight Y lock is local to the last horizontal corridor.
    if(!finalStraight508(si)){
      p.finalStraightY508=NaN;
      p.finalStraightSeg508=-1;
    }
    let targetOff=optimalOffsetFor(p);
    const plannedOff=plannedRacingOffset(p,si,now);
    const packOff=0;
    // Players are non-solid. Pack logic only adds subtle tactical route variety.
    const packWeight=Math.min(0.16,0.055+(p.drivingStyle.pack-0.90)*0.28);
    const identityWeight=.095;
    const identityOff=(p.routeIdentityBias||0)*Math.max(1.8,widths[si]*.54);
    // v4.10: globally trust the shortest optimized line more, while keeping enough
    // personality/pack weight for racers to remain recognisably different.
    targetOff=targetOff*.065+plannedOff*(.84-packWeight-identityWeight)+packOff*packWeight+identityOff*identityWeight;
      // Legacy pre-v4.64 corner shaping is retained only while an observer field is
      // active. On clear road, Racing Line 2.1 + Cornering Physics 2.0 owns the line.
      const legacyCornerShaping=false;
      // Kart-style cornering: aggressively approach the inside/apex on turns.
      const insideSide=cornerInsideSide(si);
      const turnPower=cornerIntensity(si);
      if(legacyCornerShaping && insideSide!==0 && turnPower>0.055){
        const halfRoad=Math.max(1.8,widths[si]*1.13);
        const apexOff=insideSide*halfRoad*INSIDE_CORNER_STRENGTH;
        const apexBlend=Math.min(0.999,0.955+turnPower*1.68);
        targetOff=targetOff*(1-apexBlend)+apexOff*apexBlend;
      }

      // Look ahead several route segments so the racer hugs the inside wall before
      // the corner actually begins instead of waiting until the midpoint.
      const futureInside=futureInsideBias(si);
      if(legacyCornerShaping && Math.abs(futureInside)>0.10){
        const halfRoad2=Math.max(1.8,widths[si]*1.15);
        const futureApex=futureInside*halfRoad2*1.075;
        targetOff=targetOff*0.012+futureApex*0.988;
      }

      // v4.15: hold the inside side across the whole approach straight. The
      // target is derived only from upcoming route curvature, so it works on
      // every similar section and does not encode screenshot coordinates.
      const earlyInside=openingInsideBias(si);
      if(legacyCornerShaping && Math.abs(earlyInside)>.08){
        const halfRoad3=Math.max(1.8,widths[si]*1.13);
        const insideSkill=Math.max(0,Math.min(1,(p.stats.insideLine-72)/27));
        const earlyTarget=earlyInside*halfRoad3;
        const earlyBlend=.72+insideSkill*.20;
        targetOff=targetOff*(1-earlyBlend)+earlyTarget*earlyBlend;
      }

      // v4.16: on the opening long straight, shortest-path geometry gets final
      // authority over route personality. All racers begin overlapped, then fan
      // naturally only when observer avoidance or player traits justify it.
      const openingFast=openingFastLineTarget(p,si);
      if(legacyCornerShaping && openingFast!=null){
        const read=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
        // v4.27: openingFast already contains the racer's lane signature. Give it
        // strong authority so the pack visibly fans out from the overlapped start.
        const blend=.975+read*.020;
        targetOff=targetOff*(1-blend)+openingFast*blend;
      }

    // Lower line skill adds slightly more steering error, while everyone still
    // follows the optimized racing line most of the time.
    const lineError=(100-p.profile.line)/100;
    const precision=(p.stats.insideLine+p.stats.cornering+p.stats.routeReading)/300;
    const precisionNoise=0.004+(1-precision)*0.285;
    targetOff += Math.sin((now/1000)*0.7+p.index*1.3)*half*precisionNoise;

    // High inside-line racers visibly hold a tighter apex; lower line skill leaves
    // a little more safety margin, making player identities readable in motion.
    const insideNow=cornerInsideSide(si);
    if(insideNow!==0 && cornerIntensity(si)>0.06){
      const insideCommit=(p.stats.insideLine-72)/27;
      const styleApex=(identityOf(p).apex-1)*.42;
      const personalityApex=(p.linePersonality||0)*.095;
      const skillApex=insideNow*half*Math.min(.995,Math.max(.54,0.69+insideCommit*0.23+styleApex+personalityApex));
      targetOff=targetOff*(0.40-insideCommit*0.12)+skillApex*(0.60+insideCommit*0.12);
    }

    const passPlan=null;
    if(passPlan){
      // Strong enough to be visible, but observer avoidance below still has final authority.
      const passBlend=passPlan.mode===1?.66:passPlan.mode===2?.58:.52;
      targetOff=targetOff*(1-passBlend)+passPlan.off*passBlend;
    }

    const clutchPlan=null;
    if(clutchPlan && Math.abs(clutchPlan.off)>.01){
      // Final-section decisions are visible, but avoidance below keeps final authority.
      targetOff=targetOff*.38+clutchPlan.off*.62;
    }

    targetOff=preCornerPositionTarget(p,si,now,targetOff);
    targetOff=linkedCornerTarget(p,si,targetOff);
    targetOff=precisionCornerTarget(p,si,now,targetOff);
    targetOff=finalCornerBattleTarget(p,si,now,targetOff);
    targetOff=tacticalSituationOffset(p,si,now,targetOff);
    targetOff=tacticalVariantOffset(p,si,now,targetOff);
    targetOff=stabilizeDrivingLine(p,si,targetOff);
    const humanDrive=humanDrivingAdjustment(p,si,now,targetOff);
    targetOff=humanDrive.off;
    targetOff=startOpeningTarget(p,si,now,targetOff);
    const unitAI=unitAdaptationOf(p);
    // Unit identity bends the chosen racing line, but never overrides observer avoidance.
    if(insideNow!==0 && cornerIntensity(si)>.045){
      const unitApex=insideNow*half*Math.min(.995,.70+unitAI.fit*.22);
      const ub=Math.max(0,Math.min(.24,(unitAI.apex-1)*1.8+.10));
      targetOff=targetOff*(1-ub)+unitApex*ub;
    }
    targetOff=pressureLineAdjustment(p,si,now,targetOff);
    if(now<p.shockAvoidUntil){
      targetOff=targetOff*.16+p.shockAvoidOffset*.84;
    }

    // v4.65 CLEAR-ROAD / PASS AUTHORITY: with no perceived observer field, the map-wide
    // Racing Line 2.0 is the macro route. Personality/tactics may add tiny execution
    // texture, but they may not choose a knowingly slower lane.
    const clearRoadObs=[];
    if(clearRoadObs.length===0 && now>=p.shockAvoidUntil){
      const fastLine=optimalRacingLine2Offset(p,si);
      const lineSkill=Math.max(0,Math.min(1,((p.stats.cornering+p.stats.insideLine+p.stats.routeReading+p.stats.control)/4-72)/27));
      const trust=.965+lineSkill*.030;
      targetOff=targetOff*(1-trust)+fastLine*trust;
    }

    // v4.64 CORNERING PHYSICS 2.0: the map-wide line is refined by a local
    // entry/apex/exit model only on observer-free road. Observer avoidance below
    // still has absolute final authority.
    let cornerPhysics64={off:targetOff,speedMul:1,type:"traffic"};
    if(clearRoadObs.length===0 && now>=p.shockAvoidUntil){
      cornerPhysics64=cornerPhysics64Target(p,si,targetOff);
      targetOff=cornerPhysics64.off;
    }

    // v4.66 MULTI-CAR LINE AUTHORITY:
    // 4.64 remains the solo/leader baseline. Only real nearby racer traffic may
    // bend that line; then 4.65's explicit overtake plan may make the final attack.
    let multiCar66={off:targetOff,mode:"observer",authority:0};
    if(clearRoadObs.length===0 && now>=p.shockAvoidUntil){
      const solo66=cornerPhysics64.off;
      multiCar66=multiCarRacingLine66(p,si,now,solo66);
      if(multiCar66.authority>0){
        targetOff=targetOff*(1-multiCar66.authority)+multiCar66.off*multiCar66.authority;
      }
    }

    // v4.65 PASS AUTHORITY: 4.64 correctly made the solo optimal line dominant,
    // but that also erased most passing moves. When another racer actually blocks
    // that line, allow the selected overtake corridor to override it. Observers still
    // have final authority in chooseAvoidance() below.
    if(passPlan && clearRoadObs.length===0 && now>=p.shockAvoidUntil){
      const myProg65=currentProgress(p);
      const target65=players[p.passTargetId];
      const rel65=target65&&!target65.done ? currentProgress(target65)-myProg65 : 99;
      if(rel65>-1.0 && rel65<10.5){
        const passSkill65=Math.max(0,Math.min(1,
          ((p.stats.aggression+p.stats.prediction+p.stats.routeReading+p.stats.control)/4-72)/27));
        let authority65=(passPlan.mode===2?.74:passPlan.mode===3?.70:.82)+passSkill65*.08;
        const leadPass67=leaderLineDiscipline67(p,si);
        if(leadPass67.leadBattle) authority65=Math.min(authority65,.52);
        targetOff=targetOff*(1-authority65)+passPlan.off*authority65;
        targetOff=raceLine79(p,si,targetOff,true);
      }
    }

    // v4.68 FINAL SHORTEST-LINE AUTHORITY:
    // On clear road, normal racing is pulled back toward the inside-shortest route.
    // A real active overtake is the only racer-traffic exception.
    if(clearRoadObs.length===0 && now>=p.shockAvoidUntil){
      targetOff=driverStyle68Line(p,si,targetOff,!!passPlan);
      if(!passPlan){
        // v4.70-v4.73 integrated fastest-line authority.
        const fast69=cornerPhysics64Target(p,si,optimalRacingLine2Offset(p,si)).off;
        const fast74=integratedFastLine74(p,si,fast69);
        const chase75=chaseLine75(p,si,fast74);
        const fast79=raceLine79(p,si,chase75,false);
        targetOff=targetOff*.035+fast79*.965;
      }
    }

    let speedMul=(clearRoadObs.length===0?cornerPhysics64.speedMul:humanDrive.speedMul)*unitAI.pace;
    if(passPlan) speedMul*=passPlan.speedMul;
    if(clutchPlan) speedMul*=clutchPlan.speedMul;
    if(now<p.startLaunchUntil){
      // Only the opening launch is affected; after ~2 s everyone returns to normal pace.
      speedMul*=p.startLaunchMul*p.startExecution;
    }
    const controlSkill=(p.profile.control-85)/15;

    // v4.67 LEAD-BATTLE DISCIPLINE: P1/P2 in a close fight stay almost entirely
    // on the fast line until an observer threat genuinely requires a dodge.
    const lead67=leaderLineDiscipline67(p,si);
    if(clearRoadObs.length===0 && lead67.leadBattle && now>=p.shockAvoidUntil){
      targetOff=targetOff*.03+lead67.solo*.97;
    }

    // v4.67 unified survival/racing policy. The avoidance planner still detects danger,
    // but its route is scored against the optimized racing line and large exterior arcs
    // are suppressed unless the predicted collision risk is genuinely severe.
    const avoid=null;
    if(avoid){
      if(avoid.mode==="stop"){
        speedMul*=.72;
      }else{
        const unified67=unifiedLine67(p,si,targetOff,avoid);
        const leadBlend=lead67.leadBattle?.66:.82;
        targetOff=targetOff*(1-leadBlend)+unified67.off*leadBlend;
        speedMul*=unified67.speedMul;
      }
    }
    if(!avoid && p.avoidPlanUntil && now>=p.avoidPlanUntil){
      p.avoidRecoverOffset=p.avoidPlanOffset;
      p.avoidRecoverStart=now;
      const recovery=(p.stats.recovery-72)/27;
      p.avoidRecoverUntil=now+(500-recovery*120);
      p.avoidPlanOffset=targetOff;
      p.avoidPlanSpeedMul=1;
      p.avoidPlanRisk=0;
      p.avoidPlanUntil=0;
    }
    if(!avoid && now<p.avoidRecoverUntil){
      const duration=Math.max(300,p.avoidRecoverUntil-(p.avoidRecoverStart||now));
      const t=Math.max(0,Math.min(1,(now-(p.avoidRecoverStart||now))/duration));
      // v4.64 SAFE REJOIN 3.1: recover toward the optimized line only as quickly as
      // the road ahead permits. Clear straights rejoin quickly; an approaching corner
      // or visible observer chain keeps the current safe line until the geometry settles.
      const recoveryN=Math.max(0,Math.min(1,(p.stats.recovery-72)/27));
      const routeReadN=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
      const aheadObs=0;
      let futureTurn=cornerIntensity(si);
      for(let rk=1;rk<=3;rk++) futureTurn=Math.max(futureTurn,cornerIntensity(Math.min(segs.length-1,si+rk))*(1-rk*.12));
      const clearFactor=aheadObs===0?1:(aheadObs===1?.68:.38);
      const cornerFactor=Math.max(.30,1-futureTurn*2.25);
      const smooth=t<.18 ? t*.25 : t<.68 ? .045+(t-.18)*1.28 : .685+(t-.68)*.98;
      let rejoinAuthority=Math.max(.24,Math.min(1,clearFactor*cornerFactor*(1.02+recoveryN*.10+routeReadN*.08)));
      const leadRejoin67=leaderLineDiscipline67(p,si);
      if(leadRejoin67.leadBattle && aheadObs===0){
        // P1/P2 restore the fast line quickly once the threat is clear.
        rejoinAuthority=Math.max(rejoinAuthority,.95);
      }
      const blend=Math.max(0,Math.min(1,smooth*rejoinAuthority));
      // v4.63: rejoin the future optimal macro-line, not merely the nearest local lane.
      const rejoinBase=cornerPhysics64Target(p,si,optimalRacingLine2Offset(p,si)).off;
      const rejoin=raceLine79(p,si,integratedFastLine74(p,si,rejoinBase),false);
      const from=p.avoidRecoverOffset;
      targetOff=from*(1-blend)+rejoin*blend;
      // If the road is completely clear and nearly straight, don't carry a slow
      // avoidance lane for the full recovery timer. Snap back progressively faster.
      if(aheadObs===0 && futureTurn<.075 && t>.16){
        const fastBlend=Math.min(.985,.78+(t-.16)*.78+recoveryN*.08);
        targetOff=targetOff*(1-fastBlend)+rejoin*fastBlend;
      }
    }
    // v4.10 EXTREME INSIDE: a deliberate high-risk shortest-line gamble.
    // It is applied after ordinary avoidance planning so committed racers do not
    // instantly cancel the gamble and become uniformly safe. Observer avoidance still
    // contributes through steering/control, but the racing-line commitment dominates.
    const extremeOff=extremeInsideAdjustment(p,si,now,targetOff);
    if(p.extremeInsideActive){
      const commit=p.extremeInsideFail?.94:.88;
      targetOff=targetOff*(1-commit)+extremeOff*commit;
      // Successful extreme line gets a tiny momentum reward from shorter geometry,
      // never a rubber-band speed boost. Failed attempts get no artificial slowdown.
      if(!p.extremeInsideFail) speedMul*=1.004;
    }

    const controlCanOverride = p.reactiveControl || !avoid;
    const cq=Math.max(.55,Math.min(1,p.controlQuality||1));
    const failedControl=!p.controlSuccess;
    if(controlCanOverride && p.controlMode==="zigzag"){
      const amp=((p.reactiveControl?.62:.46)+controlSkill*.09)*(failedControl?1.16:1);
      targetOff += Math.sin(now*0.023+p.index)*half*amp;
      if(failedControl) targetOff+=p.controlMistakeSide*half*.10*(1-cq);
      speedMul*=p.reactiveControl
        ? ((0.985+controlSkill*.025)*(failedControl?.91:.995))
        : ((0.945+controlSkill*.045)*(failedControl?.89:1));
    } else if(controlCanOverride && p.controlMode==="diagonal"){
      // v4.191 diagonal dodge: a short forward-biased sidestep around a nearby threat.
      const elapsed=Math.max(0,now-p.modeStart),dur=Math.max(1,p.controlUntil-p.modeStart);
      const t=Math.max(0,Math.min(1,elapsed/dur));
      const side=p.controlMistakeSide||p.liveEvadeSide||(p.index%2?1:-1);
      const pulse=Math.sin(Math.PI*t);
      targetOff += side*half*(.48+controlSkill*.12)*pulse;
      speedMul*=.99+controlSkill*.025;
    } else if(controlCanOverride && p.controlMode==="spin360"){
      // v4.191 360-control: a compact circular feint while maintaining forward progress.
      const elapsed=Math.max(0,now-p.modeStart),dur=Math.max(1,p.controlUntil-p.modeStart);
      const t=Math.max(0,Math.min(1,elapsed/dur));
      const side=p.controlMistakeSide||p.liveEvadeSide||(p.index%2?1:-1);
      targetOff += side*half*.46*Math.sin(t*Math.PI*2);
      speedMul*=.91+controlSkill*.05;
      p.visualAngle += side*(Math.PI*2)*Math.min(1,dt/dur);
    } else if(controlCanOverride && p.controlMode==="marseille"){
      const elapsed=Math.max(0,now-p.modeStart);
      const dur=Math.max(1,p.controlUntil-p.modeStart);
      const t=Math.max(0,Math.min(1,elapsed/dur));
      // v3.62: visible Marseille-style hook. Three phases:
      // commit to the open side -> curl back across the threat -> rejoin forward line.
      // It never mutates p.seg and the final offset is still clamped by the real road.
      // v3.7: clearer four-phase Marseille motion:
      // 1) hard side feint, 2) hook behind the threat, 3) opposite-side curl,
      // 4) smooth forward rejoin. Still only an offset/speed decision: never seg mutation.
      const hook=t<.25
        ? Math.sin((t/.25)*Math.PI*.5)
        : t<.56
          ? 1-Math.sin(((t-.25)/.31)*Math.PI)*1.72
          : t<.80
            ? -.72+Math.sin(((t-.56)/.24)*Math.PI*.5)*.54
            : -.18*(1-(t-.80)/.20);
      const curl=Math.sin(t*Math.PI*2)*.30;
      targetOff += p.marseilleSide*half*(hook*.78+curl);
      speedMul*=.925+Math.sin(t*Math.PI)*.070;
    } else if(controlCanOverride && p.controlMode==="backcon"){
      const elapsed=now-p.modeStart;
      const style=p.backconStyle||"long";

      if(style==="tap"){
        // Very short rear tap: immediately snaps forward after a tiny reverse.
        const reverseMs=(p.reactiveControl
          ? Math.max(38,58-controlSkill*10)
          : Math.max(48,72-controlSkill*12))*(failedControl?1.16:1);
        const escapeSide=failedControl?p.controlMistakeSide:(p.index%2?1:-1);
        targetOff += escapeSide*half*(.09+controlSkill*.035)*(failedControl?1.20:1);
        speedMul = elapsed<reverseMs
          ? (-0.10+controlSkill*.018)
          : ((1.20+controlSkill*.045)*(failedControl?.90:1));
      }else{
        // Long back-control: a clearly visible backward move followed by a stronger forward release.
        const reverseMs=(p.reactiveControl
          ? Math.max(210,310-controlSkill*60)
          : Math.max(245,365-controlSkill*72))*(failedControl?1.22:1);
        const escapeSide=failedControl?p.controlMistakeSide:(p.index%2?1:-1);
        targetOff += escapeSide*half*(p.reactiveControl?.22:.30)*(failedControl?1.24:1);
        speedMul = elapsed<reverseMs
          ? (-0.58+controlSkill*.07)
          : ((1.24+controlSkill*.065)*(failedControl?.87:1));
      }
    } else if(controlCanOverride && p.controlMode==="stopcon"){
      // v2.20: failed stop-control duration is extended once in beginControl.
      speedMul=0;
    } else if(!avoid && p.controlMode==="wide"){
      const side=(failedControl?p.controlMistakeSide:(p.index%2?1:-1));
      targetOff += side*half*(0.52+controlSkill*0.07)*(failedControl?1.12:1);
      speedMul=(0.895+controlSkill*0.055)*(failedControl?.91:1);
    }

    // v4.36 CORNER SURVIVAL 2: do not defend the perfect inside apex when the
    // personally perceived observer field makes that apex the dangerous side. This
    // is a soft, skill-aware surrender of inside line: safe corners keep the fast
    // v4.16/v4.27 route, while danger progressively moves the target toward the
    // current lane or the safer half of the road before live dodge takes authority.
    {
      const cSide=cornerInsideSide(si);
      const cPower=cornerIntensity(si);
      if(cSide!==0 && cPower>.038){
        const seen=[];
        if(seen.length){
          let insideRisk=0, outsideRisk=0, crossingRisk=0;
          const predN=Math.max(0,Math.min(1,(p.stats.prediction-72)/27));
          const riskN=Math.max(0,Math.min(1,(p.stats.riskControl-72)/27));
          for(const o of seen){
            const dx=o.x-p.x, dy=o.y-p.y;
            const along=dx*s.ux+dy*s.uy;
            if(along<-.8 || along>17.5) continue;
            const lat=dx*s.nx+dy*s.ny;
            const w=Math.max(.12,1-along/19);
            const onInside=(lat*cSide)>-.15;
            if(onInside) insideRisk+=w; else outsideRisk+=w;
            const rvx=(o.vx||0)-s.ux*p.speed, rvy=(o.vy||0)-s.uy*p.speed;
            const rv2=rvx*rvx+rvy*rvy;
            if(rv2>.01){
              const tc=Math.max(0,Math.min(1.75,-(dx*rvx+dy*rvy)/rv2));
              const cx=dx+rvx*tc, cy=dy+rvy*tc;
              const cpa=Math.hypot(cx,cy);
              if(tc>.04 && cpa<2.65){
                const cw=(2.65-cpa)/2.65*(1.2-tc*.28);
                crossingRisk+=cw;
                if((cy*s.ny+cx*s.nx)*cSide>-.2) insideRisk+=cw*.85;
                else outsideRisk+=cw*.55;
              }
            }
          }
          const apexThreat=Math.max(0,insideRisk-outsideRisk*.42)+crossingRisk*.32;
          if(apexThreat>.20){
            const halfNow=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.57);
            const surrender=Math.max(0,Math.min(.78,(apexThreat-.16)*(.34+riskN*.12+predN*.10)));
            const safeOff=cSide>0 ? Math.min(targetOff,halfNow*.18) : Math.max(targetOff,-halfNow*.18);
            targetOff=targetOff*(1-surrender)+safeOff*surrender;
            speedMul*=1-Math.min(.045,surrender*.035);
            p.cornerSurvivalSurrender=surrender;
          }else p.cornerSurvivalSurrender=0;
        }else p.cornerSurvivalSurrender=0;
      }else p.cornerSurvivalSurrender=0;
    }

    // v4.25 integrated corner + observer authority: the current racing/apex target is
    // passed into the human controller, so avoidance bends that line instead of fighting it.
    // When a visible observer is genuinely dangerous,
    // the racer temporarily abandons the ideal racing line and behaves like a human
    // making rapid mouse inputs. Once clear, v4.16 optimized/inside-line driving returns.
    // v7.19 HOTFIX3: legacy humanLiveEvadeController used a huge vision radius
    // and produced broad arcs even when Observer System 5.0 saw no real collision.
    // Observer System 5.0 inside raceEngine1019 is now the ONLY avoidance authority.
    const liveEvade=null;
    p.liveEvadeDanger=0;
    p.liveEvadeThreat=null;
    p.liveEvadeAction="none";
    p.hardRouteLockUntil=0;
    p.routeBreakCombatUntil=0;
    p.lockedEscapeOffset=undefined;
    if(liveEvade){
      const emergency=Math.max(0,Math.min(1,(liveEvade.danger-.25)/1.55));
      const observerCombat=now<(p.routeBreakCombatUntil||0);
      const hardRouteLock=now<(p.hardRouteLockUntil||0) || !!liveEvade.routeLock;
      const authority=hardRouteLock ? 1.0 : (observerCombat ? .992 : (.72+emergency*.26));
      targetOff=hardRouteLock ? liveEvade.off : targetOff*(1-authority)+liveEvade.off*authority;
      speedMul=liveEvade.speedMul<0 ? liveEvade.speedMul : speedMul*(1-authority*.35)+liveEvade.speedMul*(authority*.35);
      // Human controller is allowed to reverse briefly even though ordinary anti-freeze
      // logic forbids accidental backward movement.
      if(liveEvade.speedMul<0) p.controlMode="backcon";
      // Human Dodge Controller action is authoritative while committed. This prevents
      // the older trick controller from layering a second contradictory maneuver.
      if(p.liveEvadeAction==='stop') p.controlMode='stopcon';
    }
targetOff=clampRoadOffset(si,targetOff,p);
    const steerControl=(p.stats.control-72)/27;
    // v2.7 anti-freeze: outside collision / explicit backcon / explicit stopcon,
    // every active racer keeps meaningful forward motion.
    if(now>=p.stunUntil && p.controlMode!=="stopcon" && p.controlMode!=="backcon" && p.liveEvadeAction!=="stop" && speedMul<.62){
      speedMul=.62;
    }

    // v4.85-v4.89 final integrated race-AI discipline:
    // after all tactical/control choices, remove unjustified exterior wandering
    // while preserving proportional room for a real observer threat or pass.
    targetOff=finalRaceDiscipline89(p,si,now,targetOff,avoid,!!passPlan);

    const steerTurn=cornerIntensity(si);
    targetOff=limitDecisionChanges(p,si,now,targetOff);

    // v5.01 FINAL AUTHORITY: calm horizontal road = route centerline.
    const centerLock501=horizontalCenterLock501(p,si,now);
    if(centerLock501 || horizontalHold503(p,si)){
      targetOff=0;
      p.desiredOffset += (0-p.desiredOffset)*Math.min(1,dt*.018);
    }

    const observerCombatSteer=now<(p.routeBreakCombatUntil||0);
    const steerEase=observerCombatSteer ? Math.min(.42,dt*(.0105+steerControl*.0018)) : Math.min(.092,dt*(.00218+steerControl*.00050+steerTurn*.00048));
    if(!centerLock501){
      p.desiredOffset += (targetOff-p.desiredOffset)*steerEase;
    }


    // v5.00 NORMAL RACING TARGET — restore the proven v3-style steering model.
    // Keep the current segment line, then blend ONLY 24% toward the next segment.
    // No multi-segment optimized lookahead, no shortcut layer, no horizontal-lock layer,
    // and no v4.91 re-targeting during calm racing.
    const next=segs[Math.min(segs.length-1,si+1)];
    const centerTarget501=horizontalCenterLock501(p,si,now);
    const horizontalHold503Active=horizontalHold503(p,si);
    const routeOff501=(centerTarget501||horizontalHold503Active)?0:p.desiredOffset;
    let tx=s.b[0]+s.nx*routeOff501;
    let ty=s.b[1]+s.ny*routeOff501;

    if(next && si<segs.length-1){
      const legacyHorizontal502=Math.abs(s.ux)>=.88;
      const look=(legacyHorizontal502||horizontalHold503Active)?0:0.24;
      const nx=next.b[0]+next.nx*routeOff501;
      const ny=next.b[1]+next.ny*routeOff501;
      let candX=tx*(1-look)+nx*look;
      let candY=ty*(1-look)+ny*look;

      // Restricted red zones are planning vetoes only. If the 24% look-ahead would
      // cross one, keep the current-segment target instead of inventing a detour.
      if(!inForbidden96(candX,candY) && !lineHitsForbidden96(p.x,p.y,candX,candY)){
        tx=candX; ty=candY;
      }
    }

    // Validate only against the ordinary road corridor + planning red-zone veto.
    // If the candidate is invalid, stay on the current segment target.
    if(inForbidden96(tx,ty) || lineHitsForbidden96(p.x,p.y,tx,ty) ||
       !lineStaysOnCourse(p.x,p.y,tx,ty,ROUTE_PLAN_EXTRA)){
      const bx=s.b[0]+s.nx*p.desiredOffset;
      const by=s.b[1]+s.ny*p.desiredOffset;
      if(!inForbidden96(bx,by) && !lineHitsForbidden96(p.x,p.y,bx,by)){
        tx=bx; ty=by;
      }
    }

    // Observer emergency remains authoritative exactly as before.
    if(now<(p.hardRouteLockUntil||0) && Number.isFinite(p.lockedEscapeOffset)){
      const lockTier=p.dangerTier||0;
      const escapeAhead=(lockTier>=3?8.9:10.2)+Math.max(0,Math.min(1,(p.stats.control-72)/27))*1.35;
      let ex=p.x+s.ux*escapeAhead+s.nx*p.lockedEscapeOffset;
      let ey=p.y+s.uy*escapeAhead+s.ny*p.lockedEscapeOffset;
      const legalEscape=courseAwareTarget(p,si,ex,ey);
      tx=legalEscape.x; ty=legalEscape.y;
    }

    // v5.07 FINAL BROAD-ROAD AUTHORITY:
    // On calm broad road, replace edge-biased/offset-biased targets with the farthest
    // legal center/shortest chord through the road surface.
    // v5.20~v5.23 Racing Line 3.0 phase 1.
    const racing529=racingLine529(p,si,now);
    p.routeSource523=racing529?.kind || "legacy";
    const engineAuthority719=!!racing529 &&
      /race720|true-shortest719|global-optimal710|fastest-rejoin719|observer5/i.test(racing529.kind||"");
    const shortestCalm719=engineAuthority719 &&
      /race720-normal|true-shortest719|global-optimal710/i.test(racing529.kind||"");
    if(shortestCalm719){
      p.controlMode="normal";
      p.controlMistakeSide=0;
    }
    let broad507=null;
    if(racing529){
      tx=racing529.x;
      ty=racing529.y;
    }else{
      broad507=broadRoadTarget507(p,si,now);
      if(broad507 && !liveEvade){
        tx=broad507.x;
        ty=broad507.y;
      }
    }

    // v5.16 ROUTE -> STEERING separation.
    // Everything above chooses the route target. Only steeringTarget516 is allowed
    // to turn that route decision into the local movement target.
    const routeTarget516={x:tx,y:ty};
    // v7.19 HOTFIX1: legacy corner stabilization was pulling the true shortest
    // line back toward centerline. Bypass it only for calm shortest-path running.
    const steerTarget516=engineAuthority719
      ? routeTarget516
      : steeringTarget516(p,si,now,routeTarget516,liveEvade);
    tx=steerTarget516.x;
    ty=steerTarget516.y;

    // v6.36 final planner invariant: even legacy steering layers cannot hand
    // the virtual mouse a target whose chord leaves the legal road.
    {
      const road636=engineAuthority719
        ? actualRoadTarget719(p,si,{x:tx,y:ty,kind:"post-steer-engine719"})
        : finalRoadTarget636(p,si,{x:tx,y:ty,kind:"post-steer636"});
      if(road636){tx=road636.x;ty=road636.y;}
    }

    // v5.19: after an abnormal move, briefly shrink the next steering target
    // instead of letting a second large correction compound the mistake.
    if(now<(p.anomalyUntil519||0) && !liveEvade && !shortestCalm719){
      const s519=segs[Math.max(0,Math.min(segs.length-1,si))];
      const dx519=tx-p.x, dy519=ty-p.y;
      const f519=dx519*s519.ux+dy519*s519.uy;
      let l519=dx519*s519.nx+dy519*s519.ny;
      l519=Math.max(-.72,Math.min(.72,l519));
      const ff519=Math.max(2.0,Math.min(6.5,f519));
      tx=p.x+s519.ux*ff519+s519.nx*l519;
      ty=p.y+s519.uy*ff519+s519.ny*l519;
    }

    // v5.17: capture route-vs-steering authority before movement.
    recordDriveDebug519(p,si,now,routeTarget516,steerTarget516,0,0,liveEvade);

    // v4.59.9 AI DEATH BLACKBOX: sample what the racer actually sees/decides before
    // the virtual mouse consumes the planner output. Diagnostic only; no steering changes.
    recordAiBlackboxSample(p,now,tx,ty);

    // v7.19 HOTFIX2: the calm mathematical shortest line is a continuous
    // racing command, not a human click simulation. Mouse cadence/error was the
    // main remaining source of visible wide arcs.
    if(engineAuthority719){
      p.mouseTargetX=tx; p.mouseTargetY=ty;
      p.mouseMode="race-shortest";
      p.mouseReactionReadyAt=0;
      p.mouseNextThink=now;
      p.mouseCommandUntil=now+40;
    }else{
    // v4.23 VIRTUAL MOUSE + HUMAN REACTION + PERSONAL VISION: the planner above is now the player's "eyes + brain" only.
    // It proposes a click, but steering consumes the last committed click target.
    // Safe running uses relaxed human click cadence; real danger shortens the cadence.
    // The click event itself is logged so later replay/debug can show genuine inputs,
    // never a reconstructed movement trace.
    {
      const reactionN=Math.max(0,Math.min(1,(p.stats.reaction-72)/27));
      const controlN=Math.max(0,Math.min(1,(p.stats.control-72)/27));
      const dangerN=Math.max(0,Math.min(1,p.liveEvadeDanger||0));
      const dangerTier=p.dangerTier||0;
      const threatId=liveEvade ? (p.liveEvadeThreat??-1) : -1;
      const dangerActive=!!liveEvade || now<(p.hardRouteLockUntil||0); // v4.60 route lock forbids race-mode clicks
      // A newly recognized threat does not instantly become a mouse input. The racer
      // spends a short player-specific judgment/hand delay while continuing the last command.
      if(dangerActive && (!p.reactionDangerActive || threatId!==p.reactionThreatId)){
        const urgency=Math.max(0,Math.min(1,dangerN/1.35));
        const cmdDelay=humanCommandDelayMs(p,urgency);
        p.mouseReactionReadyAt=now+cmdDelay;
        p.lastReactionDelayMs=cmdDelay;
        p.reactionThreatId=threatId;
        p.reactionDangerActive=true;
      }else if(!dangerActive){
        p.reactionDangerActive=false;
        p.reactionThreatId=-1;
        p.mouseReactionReadyAt=0;
      }
      const distToHeld=Math.hypot((p.mouseTargetX??p.x)-p.x,(p.mouseTargetY??p.y)-p.y);
      const routeBreakInterrupt=!!p.routeBreakForceClick && dangerActive;
      const needsClick=routeBreakInterrupt || now>=p.mouseNextThink || now>=p.mouseCommandUntil || distToHeld<1.05;
      // v4.40 emergency re-judgment: human delay still exists, but an already obvious
      // imminent collision may interrupt it once instead of watching the racer drive straight in.
      // v4.43 LATE_REACTION fix: tier-2 remains an immediate interrupt; a very short
      // predicted time-to-contact can also interrupt the tail of the human delay.
      const imminentRead=dangerActive && (p.liveEvadeDanger||0)>.48 && (p.dangerTier||0)>=1;
      const emergencyReaction=dangerActive && (now<(p.routeBreakCombatUntil||0) || (p.dangerTier||0)>=2 || (p.liveEvadeDanger||0)>.72 || imminentRead);
      const reactionReady=!dangerActive || emergencyReaction || now>=(p.mouseReactionReadyAt||0);
      if(needsClick && reactionReady){
        // Human-like imperfect click placement. Better control means less pointer error.
        // Error is tiny and continuous; it does not create random lane changes.
        const err=(1-controlN)*(dangerActive?0.070:0.205);
        const reach=Math.max(.82,Math.min(1.06,p.mouseReach||1));
        let mx=p.x+(tx-p.x)*reach+(Math.random()-.5)*err;
        let my=p.y+(ty-p.y)*reach+(Math.random()-.5)*err;
        if(!dangerActive && horizontalCenterLock501(p,si,now)){
          my=ty;
        }
        // v5.00: calm-racing mouse clicks consume the v3-style planner target directly.
        // Do not run v4.90~v4.95 re-targeting layers here.
        // v4.31 shorter human clicks: reduce the frequency of long screen-spanning
        // commands. Danger uses especially short re-readable clicks so the racer can
        // react to the next observer without twitching every frame.
        const clickDx=mx-p.x, clickDy=my-p.y, clickD=Math.hypot(clickDx,clickDy)||1;
        // v4.35 tiered click reach: safe road stays relaxed, watch uses short
        // corrections, danger/emergency use decisive but still bounded escape clicks.
        // v4.59.4 clear-road reach: when the racer currently perceives no observer
        // nearby, allow a longer deliberate race click. As soon as anything enters
        // the personal field, fall back to the shorter v4.31 re-readable cadence.
        const clearForLongClick=!dangerActive && playerPerceivedObservers(p,21.5).length===0;
        const unitClick=unitAI.click||1;
        const maxClickDist=(!dangerActive ? (clearForLongClick ? (10.35+controlN*1.50) : (8.25+controlN*1.05))
          : dangerTier>=3 ? (6.75+controlN*.85)
          : dangerTier===2 ? (6.35+controlN*.82)
          : (5.75+controlN*.76))*unitClick;
        if(clickD>maxClickDist){ mx=p.x+clickDx/clickD*maxClickDist; my=p.y+clickDy/clickD*maxClickDist; }
        const legalMouse=(!dangerActive && broad507)
          ? {x:mx,y:my}
          : courseAwareTarget(p,si,mx,my);
        mx=legalMouse.x; my=legalMouse.y;
        const prevMouseX=p.mouseTargetX??p.x, prevMouseY=p.mouseTargetY??p.y;
        const nextMode=liveEvade ? (p.liveEvadeAction==='back'?'back':p.liveEvadeAction==='stop'?'stop':p.liveEvadeAction||'evade') : (now<(p.hardRouteLockUntil||0)?'route-lock':'race');
        if(Math.hypot(mx-prevMouseX,my-prevMouseY)<.38 && nextMode===(p.mouseMode||'race')) p.aiDiagRedundantClicks=(p.aiDiagRedundantClicks||0)+1;
        if(nextMode!==(p.aiDiagLastMode||'race')){ p.aiDiagModeChanges=(p.aiDiagModeChanges||0)+1; p.aiDiagLastMode=nextMode; }
        p.mouseTargetX=mx; p.mouseTargetY=my;
        p.mouseMode=nextMode;
        if(routeBreakInterrupt) p.routeBreakForceClick=false;
        p.mouseLastClickAt=now; p.mouseClickSeq=(p.mouseClickSeq||0)+1;
        if(!Array.isArray(p.mouseClickLog)) p.mouseClickLog=[];
        p.mouseClickLog.push({seq:p.mouseClickSeq,t:now,x:+mx.toFixed(3),y:+my.toFixed(3),mode:p.mouseMode,threatId:p.liveEvadeThreat??-1,perceived21:playerPerceivedObservers(p,21.5).length,danger:+(p.liveEvadeDanger||0).toFixed(3),tier:p.dangerTier||0,routeBreak:!!p.routeBreakForceClick,committed:now<(p.committedEscapeUntil||0)});
        if(p.mouseClickLog.length>1800) p.mouseClickLog.splice(0,p.mouseClickLog.length-1800);
        // v4.26 individual click rhythm: patient/safe racers use longer deliberate
        // commands; attackers/opportunists click sooner and farther. Under danger the
        // personal danger tempo remains visible without creating per-frame twitching.
        const rhythm=Math.max(.78,Math.min(1.22,p.mouseRhythm||1));
        const dangerTempo=Math.max(.78,Math.min(1.12,p.mouseDangerTempo||1));
        const calmMs=(245-reactionN*45+Math.random()*105)*rhythm;
        const dangerMs=(92-reactionN*24+Math.random()*48)*dangerTempo;
        // v4.35 tiered judgment cadence. Escalation speeds decisions up; safe road
        // remains calm. This is cadence, not omniscience: v4.23 reaction gate still applies.
        const unitThink=unitAI.think||1;
        let cadence = (dangerTier>=3 ? Math.max(48,dangerMs*.68)
          : dangerTier===2 ? Math.max(58,dangerMs*.84)
          : dangerTier===1 ? Math.max(72,dangerMs*1.02)
          : calmMs)*unitThink;
        // v4.59.5: keep v4.59.4 click reach, but hold a clean-road command slightly longer.
        if(now<(p.committedEscapeUntil||0)) cadence=Math.max(cadence,205+Math.random()*75);
        else if(now<(p.hardRouteLockUntil||0)) cadence=Math.max(cadence,175+Math.random()*65);
        else if(now<(p.routeBreakCombatUntil||0)) cadence=Math.max(cadence,145+Math.random()*55);
        if(dangerTier===0 && playerPerceivedObservers(p,21.5).length===0) cadence*=1.10;
        if(p.mouseMode==='stop') cadence=Math.min(cadence,48+Math.random()*22);
        p.mouseNextThink=now+cadence;
        p.mouseCommandUntil=now+cadence+(p.mouseMode==='stop'?18:120);
      }
      tx=p.mouseTargetX; ty=p.mouseTargetY;
    }
    }

    // v6.36 stale-click guard: a previously held mouse target may have become
    // illegal after a corner/segment transition. Revalidate it every frame.
    {
      const road636=engineAuthority719
        ? actualRoadTarget719(p,si,{x:tx,y:ty,kind:"held-engine719"})
        : finalRoadTarget636(p,si,{x:tx,y:ty,kind:"held-mouse636"});
      if(road636){
        tx=road636.x;ty=road636.y;
        p.mouseTargetX=tx;p.mouseTargetY=ty;
      }
    }

    // v5.07 direct broad-road movement:
    // do not allow stale mouse/edge commands to turn a valid broad-road straight chord
    // into a one-tile edge-following L path.
    if(engineAuthority719 || ((racing529 || (typeof broad507!=="undefined" && broad507)) && !liveEvade &&
       now>=(p.hardRouteLockUntil||0) &&
       now>=(p.routeBreakCombatUntil||0) &&
       p.controlMode==="normal")){
      // v5.13: keep the stabilized local target instead of restoring the far raw target.
      p.mouseTargetX=tx;
      p.mouseTargetY=ty;
    }

    // v5.09 LOCAL STEERING CLAMP:
    // Even if a planner target changes abruptly, only allow a modest lateral correction.
    // This prevents a leader from sweeping across the whole road and losing many places instantly.
    let dx=tx-p.x, dy=ty-p.y;
    const localSeg=segs[Math.min(si,segs.length-1)];
    if(localSeg && !engineAuthority719){
      const forward=dx*localSeg.ux+dy*localSeg.uy;
      let lateral=dx*localSeg.nx+dy*localSeg.ny;
      const phase516=cornerPhase516(p,si);
      const baseMaxLat=Math.max(.80,Math.min(1.75,widths[si]*.17));
      const maxLat=(phase516.entering||phase516.exiting) ? Math.min(baseMaxLat,1.10) : baseMaxLat;
      lateral=Math.max(-maxLat,Math.min(maxLat,lateral));
      dx=localSeg.ux*forward+localSeg.nx*lateral;
      dy=localSeg.uy*forward+localSeg.ny*lateral;
      tx=p.x+dx;
      ty=p.y+dy;
    }
    const d=Math.hypot(dx,dy) || 1;
    const legacyCalm502 =
      !liveEvade &&
      now>=(p.hardRouteLockUntil||0) &&
      now>=(p.routeBreakCombatUntil||0) &&
      p.controlMode==="normal";

    let moveDirX,moveDirY;
    const st723=ensureRaceState720(p,now);
    const lockedBack723=engineAuthority719 && st723.mode==="EVADE" &&
      /back/.test(st723.action||"") &&
      Number.isFinite(st723.backDirX723) && Number.isFinite(st723.backDirY723);

    if(lockedBack723){
      moveDirX=st723.backDirX723;
      moveDirY=st723.backDirY723;
      p.steerX=moveDirX;p.steerY=moveDirY;
      p.mouseTargetX=tx;p.mouseTargetY=ty;
    }else if(engineAuthority719){
      const wantX=dx/d,wantY=dy/d;
      if(st723.mode==="EVADE" || st723.mode==="REJOIN"){
        // v7.24(130): smooth only tactical direction changes.
        // NORMAL remains exact on the racing spline.
        let sx=Number.isFinite(p.steerX)?p.steerX:wantX;
        let sy=Number.isFinite(p.steerY)?p.steerY:wantY;
        const hard=/hard/.test(st723.action||"");
        const unit764=unitChassis764(),fit769=unitCompatibility769(p);
        const unitTurn764=unit764.turn*unit764.cornerResponse*fit769.turnMul;
        const baseTau=st723.mode==="REJOIN"?72:(hard?34:52);
        const tau=baseTau/Math.max(.88,unitTurn764);
        const a=1-Math.exp(-Math.max(1,dt)/tau);
        sx+=(wantX-sx)*a; sy+=(wantY-sy)*a;
        const sl=Math.hypot(sx,sy)||1;
        moveDirX=sx/sl; moveDirY=sy/sl;
      }else{
        moveDirX=wantX; moveDirY=wantY;
      }
      p.steerX=moveDirX;p.steerY=moveDirY;
      p.mouseTargetX=tx;p.mouseTargetY=ty;
    }else if(legacyCalm502){
      moveDirX=dx/d;
      moveDirY=dy/d;
      if(!shortestCalm719 && finalStraight508(si) && Number.isFinite(p.finalStraightY508)){
        // v5.08: after the 11 o'clock corner, the finish run is a literal horizontal line.
        moveDirX=Math.sign(route[route.length-1][0]-p.x)||1;
        moveDirY=0;
      }else if(!shortestCalm719 && horizontalHold503Active){
        // The road itself is horizontal here; do not carry any stale vertical heading.
        const dir=Math.sign(s.ux)||1;
        const centerErr=(p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny;
        if(Math.abs(centerErr)<0.55){
          moveDirX=dir;
          moveDirY=0;
        }
      }
      p.steerX=moveDirX;
      p.steerY=moveDirY;
      // Old builds did not carry a stale mouse heading into the next straight.
      p.mouseTargetX=tx;
      p.mouseTargetY=ty;
    }else{
      const ndx=dx/d, ndy=dy/d;
      const steerBlend=Math.min(.25,(.12+((p.stats.control-72)/27)*.07+cornerIntensity(si)*.06)*(unitAI.steer||1));
      p.steerX += (ndx-p.steerX)*steerBlend;
      p.steerY += (ndy-p.steerY)*steerBlend;
      const steerLen=Math.hypot(p.steerX,p.steerY)||1;
      moveDirX=p.steerX/steerLen;
      moveDirY=p.steerY/steerLen;
    }

    // v2.54 CONTINUOUS-RUN ACCELERATION:
    // uninterrupted forward running ramps to +3% effective pace over 2.6 s.
    // Any stop/reverse/backcon resets the build-up. Zigzag/normal moving dodges can
    // preserve momentum, rewarding the racer who keeps moving on the same line.
    const uninterruptedForward =
      speedMul>0.72 &&
      p.controlMode!=="stopcon" &&
      p.controlMode!=="backcon" &&
      now>=p.stunUntil;
    if(uninterruptedForward){
      p.continuousRunMs=Math.min(2600,(p.continuousRunMs||0)+dt);
    }else{
      p.continuousRunMs=0;
    }
    const runFactor=Math.max(0,Math.min(1,(p.continuousRunMs||0)/2600));
    p.continuousRunMul=1+runFactor*.03;
    if(speedMul>0) speedMul*=p.continuousRunMul;

    // v4.01 EDGE-STRIP SPEED NORMALIZATION:
    // The legal one-line strips on BOTH outer edges are normal road, not slow terrain.
    // Merely choosing/riding the edge line must never reduce pace. Real observer avoidance
    // and explicit control moves may still change speed when there is an actual threat.
    {
      const edgeRoadHalf=Math.max(1.8,widths[si]*ROAD_MARGIN*(p.wideDetourRace?1.025:1));
      const edgeLat=(p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny;
      if(Math.abs(edgeLat)>=edgeRoadHalf*.82 && p.controlMode==="normal"){
        const edgeThreats=playerPerceivedObservers(p,7.5);
        if(!edgeThreats.length) speedMul=Math.max(speedMul,1.0);
      }
    }

    // v3.3 오른쪽 3시 구간(seg 5~11): 실제 옵저버 위협/컨트롤이 없으면
    // 패스·코너 준비 AI 때문에 체감 감속이 생기지 않도록 정상 주행 속도를 보장.
    if(si>=5 && si<=11 && now>=p.stunUntil && p.controlMode==="normal"){
      const eastThreats=playerPerceivedObservers(p,7.5);
      if(!eastThreats.length) speedMul=Math.max(speedMul,1.0);
    }

    if(engineAuthority719) speedMul=speedMultiplier720(p,now,dt);
    const step=p.speed*speedMul*dt/1000;
    // v7.85 EDGE-FLOW: on the two optimized maps, calm NORMAL movement is
    // authoritative spline motion. Near a legal road edge, target validation may
    // temporarily shrink the look-ahead target almost onto the racer. Capping the
    // physical step by that tiny target distance made the unit hesitate/freeze even
    // though the spline ahead was valid. Keep full forward spline progress in NORMAL;
    // EVADE/REJOIN and every other map retain the existing target-distance cap.
    const edgeFlow785=!!currentMap770().edgeFlow785 && st723.mode==="NORMAL" &&
      shortestCalm719 && /race720-normal/.test(racing529?.kind||"");
    const move=edgeFlow785 ? Math.max(0,step) :
      (step>=0 ? Math.min(step,d) : Math.max(step,-0.55));

    // v5.18: abnormal-driving detector.
    detectAnomaly519(p,si,now,tx,ty,moveDirX,moveDirY);

    // v5.17 debug HUD data uses the actual final movement vector.
    recordDriveDebug519(p,si,now,routeTarget516,steerTarget516,moveDirX,moveDirY,liveEvade);

    const preMoveX719=p.x, preMoveY719=p.y;
    if(st723.mode==="NORMAL" && shortestCalm719 && /race720-normal/.test(racing529?.kind||"") && move>0){
      // v7.20 NORMAL: actual rendered position advances on the rounded racing spline.
      if(!advanceOnSpline720(p,move)){
        p.x=preMoveX719+moveDirX*move;
        p.y=preMoveY719+moveDirY*move;
      }
    }else{
      // v7.20 EVADE / REJOIN: shortest-line lock is released.
      p.x += moveDirX*move;
      p.y += moveDirY*move;
      if(engineAuthority719)syncEvadeSplineProgress754(p,preMoveX719,preMoveY719);
    }

    // v7.54 invariant: no non-backcon control may relocate a racer farther than
    // a physically plausible simulation step. This is a last-line guard, not wall rollback.
    if(engineAuthority719){
      const act754=p._raceState720?.action||"none";
      noTeleportGuard754(p,preMoveX719,preMoveY719,move,act754);
    }

    // v7.80: only explicitly marked obstacle zones are physically non-drivable.
    enforceHardForbidden780(p,preMoveX719,preMoveY719);

    // v7.89: far exterior wandering is not an AI route. Crossing the visible edge is
    // still legal, but a large excursion requests a smooth REJOIN on the next frames.
    softOuterRecovery789(p,now);

    // v7.34: the final Racing Spline / EVADE engine already supplies legal targets.
    // Never project or roll it back to a legacy segment/lastLegal position: that was
    // the source of the visible backward teleport on the two vertical inside lines.
    if(!engineAuthority719) enforcePhysicalRoad636(p);

    if(st723.mode==="NORMAL" && shortestCalm719 && /race720-normal/.test(racing529?.kind||"")){
      p._actualShortestDeviation719=splineDeviation720(p);
    }

    // v5.00 restricted zones are PLANNING-ONLY.
    // If numerical error or emergency motion happens to enter one, do not teleport,
    // roll back, freeze, bounce, or otherwise alter the actual movement.

    // v5.00: no shortcut-route resync. Segment advancement below is sequential again.

    // v7.87 AIR UNIT: road rails are visual only — no wall, snap, bounce, off-road slowdown or edge death.
    // Explicit hardForbidden780 obstacles are handled separately above.
    if(lethalOutsideRoad(p,now)){
      p.dead=true;
      p.match.collisions++;
      p.match.deathPoints.push({round:currentRound,t:Math.max(0,now-raceStart),progressPct:+(100*Math.max(0,Math.min(1,currentProgress(p)/routeLength))).toFixed(1),x:+p.x.toFixed(2),y:+p.y.toFixed(2),...deathCauseSnapshot(p,now,null,"OUTSIDE")});
      p.cleanConfidenceMs=0; p.cleanConfidence=0;
      return;
    }
    p.match.distance += Math.hypot(p.x-p.match.lastX,p.y-p.match.lastY);
    p.match.lastX=p.x;
    p.match.lastY=p.y;

    // v2.15 race telemetry: sample the actual driven line and a lightweight trace.
    // Sampling is throttled so this does not grow with render FPS.
    const teleSeg=segs[Math.min(p.seg,segs.length-1)];
    const tdx=p.x-teleSeg.a[0], tdy=p.y-teleSeg.a[1];
    const actualOff=tdx*teleSeg.nx+tdy*teleSeg.ny;
    const insideSideNow=cornerInsideSide(Math.min(p.seg,segs.length-1));
    if(insideSideNow!==0 && cornerIntensity(Math.min(p.seg,segs.length-1))>.04){
      p.match.lineSamples++;
      const roadHalf=Math.max(1.8,widths[Math.min(p.seg,widths.length-1)]*.57);
      const insideAmount=(actualOff*insideSideNow)/roadHalf;
      if(insideAmount>.48) p.match.insideHits++;
      if(insideAmount>.82) p.match.extremeInsideHits++;
    }
    if(now-(p.match.lastTraceAt||0)>=260){
      p.match.lastTraceAt=now;
      if(p.match.trace.length<260) p.match.trace.push([+p.x.toFixed(2),+p.y.toFixed(2)]);
    }

    // v7.19 HOTFIX1: shortest corner cuts cross macro joints before the old
    // centerline endpoint. Synchronize first, then retain legacy micro-segment advancement.
    syncShortestSegment719(p,now);

    // Robust segment advancement: crossing the end plane OR entering the next joint zone.
    // A short while-loop handles high FPS drops without skipping/sticking.
    let advances=0;
    while(p.seg<segs.length-1 && advances<3){
      const cs=segs[p.seg];
      const rx=p.x-cs.a[0], ry=p.y-cs.a[1];
      const alongPx=rx*cs.ux+ry*cs.uy;
      const endDx=p.x-cs.b[0], endDy=p.y-cs.b[1];
      const nearEnd=endDx*endDx+endDy*endDy<11.56;
      const horizontal503=Math.abs(cs.ux)>=.88;
      const advanceFrac503=horizontal503?0.985:0.91;
      const nearEndAllowed503=horizontal503
        ? (endDx*endDx+endDy*endDy<2.25)
        : nearEnd;
      if(alongPx>=cs.L*advanceFrac503 || nearEndAllowed503){
        p.seg++;
        advances++;
      } else break;
    }

    // v7.76 START/FINISH + one-lap finish authority.
    const last=route[route.length-1];
    const fs=segs[segs.length-1];
    const frx=p.x-fs.a[0], fry=p.y-fs.a[1];
    const finishAlong=frx*fs.ux+fry*fs.uy;
    const finishDx=p.x-last[0], finishDy=p.y-last[1];

    const lapRule775=mapLapRule775();
    const splineTotal775=Math.max(1,RACING_SPLINE_SEGS_720.total||1);
    const splineFrac775=Math.max(0,Math.min(1,(Number(p._splineProg720)||0)/splineTotal775));
    const segFrac775=segs.length>1?Math.max(0,Math.min(1,p.seg/(segs.length-1))):0;
    const lapFrac775=Math.max(splineFrac775,segFrac775);
    p._lapMaxFraction775=Math.max(p._lapMaxFraction775||0,lapFrac775);

    // A real lap must physically pass the middle of the course before FINISH can arm.
    // This prevents a circuit whose START/FINISH boxes overlap from finishing at launch.
    if(lapRule775.lapRequired && !p._lapCheckpoint775){
      const mid775=splinePointAt720(splineTotal775*.50);
      const checkpointRadius775=Math.max(5.5,(widths[Math.min(p.seg,widths.length-1)]||10)*.72);
      if(lapFrac775>=.38 && lapFrac775<=.68 &&
         Math.hypot(p.x-mid775.x,p.y-mid775.y)<=checkpointRadius775)
        p._lapCheckpoint775=true;
    }
    if(lapRule775.lapRequired && p._lapCheckpoint775 &&
       p._lapMaxFraction775>=lapRule775.armFraction)
      p._lapArmed775=true;

    const finishGate775=
      p.seg>=segs.length-1 &&
      (finishAlong>=fs.L*0.88 || finishDx*finishDx+finishDy*finishDy<38.44);
    const finishEligible775=!lapRule775.lapRequired || !!p._lapArmed775;

    if(finishEligible775 && finishGate775){
      p.done=true;
      p._lapComplete775=!!lapRule775.lapRequired;

      // v2.29 sub-tick finish interpolation. Simulation remains 50Hz, but the
      // crossing time is estimated inside the final 20ms step for millisecond results.
      const gateAlong=fs.L*.88;
      const prevX=p.match.lastX, prevY=p.match.lastY;
      const prevAlong=(prevX-fs.a[0])*fs.ux+(prevY-fs.a[1])*fs.uy;
      const curAlong=finishAlong;
      let crossFrac=1;
      if(curAlong>prevAlong+.0001 && prevAlong<gateAlong && curAlong>=gateAlong){
        crossFrac=Math.max(0,Math.min(1,(gateAlong-prevAlong)/(curAlong-prevAlong)));
      }
      const preciseNow=now-dt*(1-crossFrac);
      p.finishTime=Math.max(0,preciseNow-raceStart);
      registerFinishRecord(p,p.finishTime);
      const finished=players.filter(q=>q.done&&q.finishTime!=null).sort((a,b)=>a.finishTime-b.finishTime);
      if(finished.length===1)setBroadcastStory(`finish-${p.index}`,"FINISH",`${p.name} 1위 확정`,formatTime(p.finishTime),now,2400);
      else if(finished.length===2){
        const gap=Math.abs(finished[1].finishTime-finished[0].finishTime);
        if(gap<=500){
          const tier=gap<=10?"DEAD HEAT":gap<=50?"ULTRA PHOTO":gap<=150?"PHOTO FINISH":"CLOSE FINISH";
          setBroadcastStory(`photo-live-${finished[0].index}-${finished[1].index}`,tier,
            `${finished[0].name} vs ${finished[1].name}`,`+${(gap/1000).toFixed(3)}s`,now,3000);
        }
      }
      return;
    }

    // v7.34: legacy rescue relocates by old route segment and can jump a spline racer.
    if(!engineAuthority719) rescueIfStuck(p,now);

    // v2.50 danger + near miss telemetry.
    if(!safeAt(p.x,p.y)){let nearestObsSq=Infinity;for(const o of playerNearbyObservers(p,3)){const dx=p.x-o.x,dy=p.y-o.y,d2=dx*dx+dy*dy;if(d2<nearestObsSq)nearestObsSq=d2;}if(nearestObsSq<10.24)p.match.dangerExposureMs+=dt;const hitR764=playerHitRadius764(p),hitSq=hitR764*hitR764;if(nearestObsSq>hitSq&&nearestObsSq<1.1664&&now-(p.match.lastNearMissAt||0)>420){p.match.nearMisses++;if(nearestObsSq<.3844)p.match.extremeNearMisses++;p.match.lastNearMissAt=now;addAutoHighlight("NEAR_MISS",`NEAR MISS · ${p.name}`,now,p.index,nearestObsSq<.3844?2:1);}}

    // Players are non-solid and may overlap completely.
    // Collision here is observer-only: player-player contact never pushes, slows, or stops anyone.
    // Collision check: actual observer contact = guaranteed stop outside invincible safe zones.
    if(!safeAt(p.x,p.y) && now>=p.invUntil && now>=p.collisionLockUntil){
      const hitR764=playerHitRadius764(p);
      for(const o of playerNearbyObservers(p,hitR764+1.0)){
        const observerStep=Math.hypot(o.x-(o.simPrevX??o.x),o.y-(o.simPrevY??o.y));
        const broad=hitR764+Math.hypot(p.x-p.simPrevX,p.y-p.simPrevY)+observerStep+.18;
        const opx=o.simPrevX??o.x, opy=o.simPrevY??o.y;
        const xFar=Math.abs(o.x-p.x)>broad && Math.abs(o.x-p.simPrevX)>broad &&
          Math.abs(opx-p.x)>broad && Math.abs(opx-p.simPrevX)>broad;
        const yFar=Math.abs(o.y-p.y)>broad && Math.abs(o.y-p.simPrevY)>broad &&
          Math.abs(opy-p.y)>broad && Math.abs(opy-p.simPrevY)>broad;
        if(xFar||yFar) continue;
        if(playerObserverHit(p,o)){
          p.hits++;
          p.hitFxUntil=0;
          p.dead=true;
          p.match.collisions++;
          p.match.deathPoints.push({
            round:currentRound,
            t:Math.max(0,now-raceStart),
            progressPct:+(100*Math.max(0,Math.min(1,currentProgress(p)/routeLength))).toFixed(1),
            x:+p.x.toFixed(2),y:+p.y.toFixed(2),
            ...deathCauseSnapshot(p,now,o)
          });
          triggerFollowerShockAvoid(p,o,now);
          p.cleanConfidenceMs=0;
          p.cleanConfidence=0;
          p.continuousRunMs=0;
          p.continuousRunMul=1;
          p.lastAdvanceAt=p.stunUntil;
          p.avoidPlanUntil=0;
          break;
        }
      }
    }
    if(shortestCalm719 && /race720-normal/.test(racing529?.kind||"")){
      p._lastLegal619={x:p.x,y:p.y};
      p._lastLegal636={x:p.x,y:p.y};
    }else{
      enforceRoadPosition619(p);
    }
  }

  // v4.59.9 rolling AI death blackbox. Keeps only the last ~5.5 seconds.
  function recordAiBlackboxSample(p,now,plannedX,plannedY){
    if(now<(p.aiBlackboxNextSample||0)) return;
    p.aiBlackboxNextSample=now+120;
    if(!Array.isArray(p.aiBlackbox)) p.aiBlackbox=[];
    const seen=playerPerceivedObservers(p,28);
    let close7=0, front12=0;
    const si=Math.min(p.seg,segs.length-1), seg=segs[si];
    const fx=seg?.ux||0, fy=seg?.uy||0;
    for(const o of seen){
      const dx=o.x-p.x,dy=o.y-p.y,d=Math.hypot(dx,dy);
      if(d<7) close7++;
      if(d<12 && dx*fx+dy*fy>0) front12++;
    }
    p.aiBlackbox.push({
      t:Math.round(now),x:+p.x.toFixed(2),y:+p.y.toFixed(2),
      plannedX:+plannedX.toFixed(2),plannedY:+plannedY.toFixed(2),
      heldX:+(p.mouseTargetX??p.x).toFixed(2),heldY:+(p.mouseTargetY??p.y).toFixed(2),
      mode:p.mouseMode||'race',action:p.liveEvadeAction||'none',threat:p.liveEvadeThreat??-1,
      danger:+(p.liveEvadeDanger||0).toFixed(3),tier:p.dangerTier||0,
      perceived28:seen.length,close7,front12,
      reactionPending:!!p.reactionDangerActive && (p.mouseReactionReadyAt||0)>now,
      routeBreak:!!p.routeBreakForceClick,combat:now<(p.routeBreakCombatUntil||0),
      committed:now<(p.committedEscapeUntil||0),commitSide:p.committedEscapeSide||0,hardRouteLock:now<(p.hardRouteLockUntil||0),lockedOffset:Number.isFinite(p.lockedEscapeOffset)?+p.lockedEscapeOffset.toFixed(2):null
    });
    const cutoff=now-5500;
    while(p.aiBlackbox.length && p.aiBlackbox[0].t<cutoff) p.aiBlackbox.shift();
  }

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

  function triggerFollowerShockAvoid(hitPlayer,observer,now){
    const hitProg=currentProgress(hitPlayer);
    for(const q of players){
      if(q===hitPlayer||q.done||now<q.stunUntil) continue;
      const gap=hitProg-currentProgress(q);
      if(gap<=0||gap>3.8) continue;
      const s=segs[Math.min(q.seg,segs.length-1)];
      const dx=observer.x-q.x,dy=observer.y-q.y;
      const lat=dx*s.nx+dy*s.ny;
      const half=Math.max(2.2,widths[Math.min(q.seg,widths.length-1)]*.55);
      // Not every follower reacts perfectly: roughly 40%, scaled by prediction/reaction.
      const skill=((q.stats.prediction+q.stats.reaction)-144)/54;
      if(Math.random()>.24+Math.max(0,Math.min(1,skill))*.30) continue;
      const side=lat>=0?-1:1;
      q.shockAvoidOffset=side*half*.88;
      q.shockAvoidUntil=now+420+Math.random()*220;
      q.avoidPlanUntil=0;
      q.decisionLockUntil=0;
      q.match.avoids++;
      addAutoHighlight("FOLLOWER_SAVE",`${q.name} · 앞선수 충돌 보고 긴급 회피`,now,q.index,2);
    }
  }

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
    if(diagFps>0 && diagFps<42){
      fpsGoodSince=0;
      fpsLowSince=fpsLowSince||now;
      if(now-fpsLowSince>1600 && fpsProtectLevel<2){
        fpsProtectLevel++;
        fpsLowSince=now;
      }
    }else if(diagFps>=54){
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

  function liveOrderedPlayers(){
    return [...players].sort((a,b)=>{
      if(a.done&&b.done) return a.finishTime-b.finishTime;
      if(a.done) return -1;if(b.done) return 1;
      return currentProgress(b)-currentProgress(a);
    });
  }
  function setBroadcastStory(key,kicker,title,sub,now=gameNow(),hold=1800){
    const k={"NEW LEADER":"선두 교체","FINAL BATTLE":"결승선 승부","3-WAY BATTLE":"3인 접전","BIG COMEBACK":"대역전","LEADER WATCH":"선두 수성","PHOTO FINISH":"포토피니시"}[kicker]||kicker;
    commentaryLine(`story-${key}`,`${k}! ${title}${sub?` · ${sub}`:""}`,now);
  }

  function updateCamera(dt){
    const now=gameNow();

    // Manual POV is the only intentional override of P1 following.
    const pov=players[povPlayerIndex];
    if(povPlayerIndex>=0 && pov && !pov.done && !pov.dead){
      cameraLeaderId=pov.index;
      smoothCamera665(dt,pov.x,pov.y);
      return;
    }

    const cache=(raceFrameCache668.stamp===now)?raceFrameCache668:rebuildRaceFrameCache668(now);
    const leader=cameraSubject661(now);
    if(!leader) return;

    cameraLeaderId=leader.index;
    cameraLeaderHoldUntil=now;

    broadcastCamera695(now,dt,leader,cache);
  }

  function finalizeIndividualClear(finishers,now){
    if(roundTransitioning) return; roundTransitioning=true;
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
    setBroadcastStory(`all-dead-${r}`,"ALL OUT",`${ROUND_UNIT_NAMES[r]} 전원 사망`,`같은 라운드 재시작`,gameNow(),900);
    setTimeout(()=>{currentRound=r;resetRound();start();},900);
  }

  function finalizeRound(){
    if(roundTransitioning) return;
    roundTransitioning=true;

    const ordered=[...players].sort((a,b)=>a.finishTime-b.finishTime);
    const result={round:currentRound,unit769:{...unitChassis764(currentRound)},
      team:{A:0,B:0,C:0,D:0},
      leaderChanges:raceLeaderChanges,totalOvertakes:raceTotalOvertakes,players:[]};

    ordered.forEach((p,idx)=>{
      const pts=ROUND_POINTS[idx];
      const team=p.team;
      result.team[team]+=pts;
      teamTotals[team]+=pts;
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
    const el=document.getElementById("teamScoreBoard"); if(el) el.style.display="none";
    renderPersonalScore();
  }

  function renderPersonalScore(){
    const el=document.getElementById("personalScoreBoard"); if(!el) return;
    const rows=Object.values(playerTournament).sort((a,b)=>b.total-a.total || a.name.localeCompare(b.name));
    el.innerHTML=`<div class="personal-score-title">개인 클리어 점수 · 5점 선승</div>`+
      rows.map((pt,i)=>`<div class="personal-score-row"><span class="personal-rank">${i+1}</span><span class="score-dot" style="background:${teamColor(pt.team)}"></span><span class="personal-name">${pt.name}</span><b>${pt.total}</b></div>`).join("");
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
  const MAX_SIM_STEPS = 6;
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
    if(map.complete) rctx.drawImage(map,0,0,rc.width,rc.height);
    const sx=rc.width/MAP_W, sy=rc.height/MAP_H;
    const focus=replayFocusId>=0?replayFocusId:frame.leader;
    for(let i=0;i<frame.p.length;i++){
      const q=frame.p[i], p=players[i];
      const x=q[0]*sx, y=q[1]*sy, focused=i===focus;
      rctx.beginPath();
      rctx.arc(x,y,focused?5.8:3.9,0,Math.PI*2);
      rctx.fillStyle=teamColor(p.team);
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

  function simulateStep(now,dt){
    updateObservers(now,dt);
    playerNearbyFrameSerial++;
    simTickCounter++;

    // v7.32: split periodic work across different simulation ticks.
    // This removes the old ~280 ms "grid + prediction" same-frame spike.
    if(simTickCounter===7) rebuildObserverGrid();
    if(simTickCounter>=14){
      simTickCounter=0;
      precomputeObserverPredictions(now);
    }

    for(let i=0;i<players.length;i++){
      sanitizeRaceState666(players[i]);
      updatePlayer(players[i],now,dt);
      sanitizeRaceState666(players[i]);
      stabilityAudit698(players[i],now);
    }
    telemetryStep696(now,dt);
    rebuildRaceFrameCache668(now);
    prevCamX730=camX; prevCamY730=camY;
    updateCamera(dt);
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
    if(frameDelta>80) frameDelta=80;
    simAccumulator+=frameDelta;

    if(!simClock) simClock=ts-simAccumulator;

    let steps=0;
    while(simAccumulator>=SIM_STEP_MS && steps<MAX_SIM_STEPS){
      simClock+=SIM_STEP_MS;
      simulateStep(simClock,SIM_STEP_MS);
      simAccumulator-=SIM_STEP_MS;
      steps++;
    }

    // Never allow a backlog to grow for seconds after a browser/GC stall.
    if(simAccumulator>SIM_STEP_MS*6) simAccumulator=SIM_STEP_MS*6;

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
    if(roundFinishers.length){
      running=false;
      finalizeIndividualClear(roundFinishers,ts);
      return;
    }
    if(players.every(p=>p.dead)){
      running=false;
      restartSameIndividualRound();
      return;
    }

    if(false && players.every(p=>p.done)){
      const fin=[...players].sort((a,b)=>a.finishTime-b.finishTime);
      if(fin[0])commentaryLine(`round-finish-${currentRound}`,`${currentRound}라운드 종료! ${fin[0].name}이 1위로 결승선을 통과했습니다.`,ts,true);
      running=false;
      finalizeRound();
      return;
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
      ctx.strokeStyle=teamColor(p.team);
      ctx.lineWidth=Math.max(2,r*.22);
      ctx.lineCap="round";
      ctx.beginPath();
      ctx.arc(-p.marseilleSide*r*.18,r*.10,r*(1.18+mt*.34),
        Math.PI*(.20+mt*.34),Math.PI*(1.02+mt*.74),p.marseilleSide<0);
      ctx.stroke();
      ctx.restore();
    }

    const sprite=unitSprites[currentRound]?.[p.team];
    if(sprite && sprite.complete && sprite.naturalWidth){
      const size=r*2.65;
      ctx.save();
      ctx.rotate(p.visualAngle+marseilleVisualSpin);
      ctx.shadowColor=p.team==="A" ? "rgba(255,77,77,.45)" :
        p.team==="B" ? "rgba(77,141,255,.45)" :
        p.team==="C" ? "rgba(255,216,77,.45)" : p.team==="D" ? "rgba(57,212,106,.45)" : "rgba(255,255,255,.35)";
      ctx.shadowBlur=Math.max(2,r*.18);
      ctx.drawImage(sprite,-size/2,-size/2,size,size);
      ctx.restore();
    }else{
      // Sprite-load fallback stays team-colored; collision never changes the icon.
      ctx.fillStyle=teamColor(p.team);
      ctx.strokeStyle="#07111a";
      ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();
    }

    ctx.fillStyle="#07111a";
    ctx.font=`900 ${Math.max(12,r*.85)}px system-ui`;
    ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(String(rank),0,1);

    // Nickname directly over the icon.
    ctx.font=`800 ${Math.max(10,r*.82)}px system-ui`;
    const label=p.name;
    const tw=ctx.measureText(label).width+14;
    const lh=Math.max(15,r*1.02);
    const ly=-r*1.48;
    ctx.fillStyle="rgba(5,8,13,.88)";
    ctx.strokeStyle=teamColor(p.team);ctx.lineWidth=1.5;
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(-tw/2,ly-lh,tw,lh,5);
    else ctx.rect(-tw/2,ly-lh,tw,lh);
    ctx.fill();ctx.stroke();
    ctx.fillStyle="#fff";ctx.textBaseline="bottom";
    ctx.fillText(label,0,ly-2);

    ctx.restore();
  }

  const renderOrder=[];

  function miniCrop770(){return currentMap770().miniCrop||{x:0,y:0,w:MAP_W,h:MAP_H};}
  let lastMiniMapRender=0;
  function renderMiniMap(force=false){
    const now=performance.now();
    const miniInterval=fpsProtectLevel>=2?200:125;
    if(!force&&now-lastMiniMapRender<miniInterval)return;
    lastMiniMapRender=now;
    const mc=document.getElementById("miniMap");
    if(!mc||!map.complete)return;
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
      miniZone775(zones775.start,"#ff3b3b");
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
      drawZone(zones.start,"#ff3b3b",false);
    }else{
      drawZone(zones.start,"#ffd92f");
      drawZone(zones.goal,"#39ff6a");
    }
  }

  function render(ts){
    const W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);
    if(!map.complete) return;

    const view=getView();
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality="high";
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

  function estimatedFinishSeconds(p,now=gameNow()){
    if(!raceStart || p.done) return p.finishTime ? p.finishTime/1000 : null;
    const prog=Math.max(1,currentProgress(p));
    const elapsed=Math.max(.1,(now-raceStart)/1000);
    const rate=prog/elapsed;
    return rate>0 ? elapsed+(routeLength-prog)/rate : null;
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
      STOPCON:"스탑컨 회피",FINISH:"완주",WIN:"우승",CLEAN:"무충돌",
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

  function pushRaceEvent(text,now=gameNow()){
    raceEventText=text;raceEventUntil=now+1600;
    const spoken=text.replace("OVERTAKE · ","추월! ").replace("NEW LEADER · ","새로운 선두! ").replace(/최고 구간기록 (\d+) · /,"최고 구간기록! ").replace("FINISH · ","결승선 통과! ");
    // v2.43: LIVE commentary removed; highlights/events are still recorded.
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
          pushRaceEvent(`최고 구간기록 ${si+1} · ${p.name} ${formatTime(sectorMs)}`,now);
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
          pushRaceEvent(`OVERTAKE · ${p.name} ${prev}위 → ${rank}위`,now);
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
        pushRaceEvent(`NEW LEADER · ${ordered[0].name}`,now);

        addAutoHighlight("LEAD_CHANGE",`NEW LEADER · ${ordered[0].name}`,now,ordered[0].index,2);
      }
      lastLeaderName=ordered[0].name;
    }
  }


  let lastLiveStatsRender=0;

  function livePerformanceRating(p,ordered,now=gameNow()){
    const rank=Math.max(1,ordered.indexOf(p)+1);
    const progress=Math.max(0,Math.min(1,currentProgress(p)/routeLength));
    const m=p.match||{};
    const avoidAttempts=Math.max(1,(m.avoids||0)+(m.collisions||0));
    const avoidRate=(m.avoids||0)/avoidAttempts;
    const controlRate=(m.controlAttempts||0)>0 ? (m.controlSuccesses||0)/(m.controlAttempts||1) : .72;
    const rankScore=(12-rank)/11;
    const passScore=Math.min(1,(m.overtakes||0)/5);
    const collisionPenalty=Math.min(1,(m.collisions||0)/3);
    const leadScore=Math.min(1,(m.leadMs||0)/Math.max(1000,(now-raceStart)));
    const gainScore=Math.max(0,Math.min(1,(m.maxRankGain||0)/5));

    // Integrated live performance: survival/avoidance has the largest weight.
    // Current rank matters, but cannot by itself create an elite rating.
    const composite=
      avoidRate*.30 +
      rankScore*.20 +
      controlRate*.14 +
      passScore*.11 +
      leadScore*.08 +
      gainScore*.07 +
      progress*.10 -
      collisionPenalty*.18;
    return Math.max(4.0,Math.min(10.0,5.15+composite*4.85));
  }

  function renderLiveRatings(now=gameNow()){
    const box=document.getElementById("liveRatingList");
    if(!box)return;
    const ordered=liveOrderedPlayers();
    if(!ordered.length){box.innerHTML="";return;}
    box.innerHTML=ordered.map(p=>{
      const rating=livePerformanceRating(p,ordered,now);
      if(now-(p.lastRatingSampleAt||0)>=900){
        p.lastRatingSampleAt=now;p.liveRatingHistory.push(rating);
        if(p.liveRatingHistory.length>24)p.liveRatingHistory.shift();
      }
      const h=p.liveRatingHistory.length?p.liveRatingHistory:[rating];
      const pts=h.map((v,i)=>`${(h.length===1?117:i*117/(h.length-1)).toFixed(1)},${(20-Math.max(0,Math.min(1,(v-4)/6))*18).toFixed(1)}`).join(" ");
      const last=h[h.length-1];
      const endX=(h.length===1?117:117).toFixed(1);
      const endY=(20-Math.max(0,Math.min(1,(last-4)/6))*18).toFixed(1);
      return `<div class="live-rating-row" style="--player-color:${p.color}">
        <span class="live-rating-name"><i class="rating-dot"></i>${p.name}</span>
        <svg class="rating-spark" viewBox="0 0 118 22" aria-label="${p.name} 실시간 평점 추이">
          <line class="rating-baseline" x1="0" y1="20" x2="118" y2="20"/>
          <polyline points="${pts}" style="stroke:${p.color}"/>
          <circle cx="${endX}" cy="${endY}" r="1.8" style="fill:${p.color}"/>
        </svg>
        <strong class="live-rating-value" style="color:${p.color}">${rating.toFixed(1)}</strong>
      </div>`;
    }).join("");
  }

  const rankRowCache=new Map();

  function rankRowFor(index){
    let c=rankRowCache.get(index);
    if(c) return c;
    const row=document.createElement("div");
    row.className="rank-row";
    row.innerHTML=`<span class="rank-no"></span><span class="rank-trend"></span>
      <span class="team-mini"></span><button class="rank-name player-link"></button>
      <span class="rank-gap"></span>`;
    const no=row.querySelector(".rank-no");
    const trend=row.querySelector(".rank-trend");
    const team=row.querySelector(".team-mini");
    const name=row.querySelector(".rank-name");
    const gap=row.querySelector(".rank-gap");
    name.dataset.player=String(index);
    name.addEventListener("click",()=>{
      const idx=Number(name.dataset.player);
      if(players[idx]) openPlayerCard(players[idx]);
    });
    c={row,no,trend,team,name,gap};
    rankRowCache.set(index,c);
    return c;
  }

  function rankingTimeClass(ms){
    const sec=Math.max(0,ms/1000);
    if(sec<40) return "time-u40";
    if(sec<50) return "time-40";
    if(sec<60) return "time-50";
    if(sec<70) return "time-60";
    if(sec<80) return "time-70";
    if(sec<90) return "time-80";
    return "time-90";
  }

  function renderRanking(){
    const ordered=[...players].sort((a,b)=>{
      if(a.done && b.done) return a.finishTime-b.finishTime;
      if(a.done) return -1;if(b.done) return 1;
      if(a.dead!==b.dead) return a.dead?1:-1;
      const diff=currentProgress(b)-currentProgress(a);
      if(Math.abs(diff)<0.20) return a.index-b.index;
      return diff;
    });
    if(!ordered.length) return;
    const frag=document.createDocumentFragment();
    const leaderProg=currentProgress(ordered[0]);

    for(let i=0;i<ordered.length;i++){
      const p=ordered[i], c=rankRowFor(p.index);
      let gapText;
      if(p.done) gapText=formatTime(p.finishTime);
      else if(p.dead) gapText="사망";
      else if(i===0) gapText="선두";
      else{
        const distGap=Math.max(0,leaderProg-currentProgress(p));
        gapText=`+${(distGap/Math.max(1,ordered[0].speed||1)).toFixed(2)}초`;
      }
      const rank=i+1, oldRank=previousUiRanks.get(p.index);
      const trendText=oldRank==null?"":rank<oldRank?"▲":rank>oldRank?"▼":"";
      previousUiRanks.set(p.index,rank);
      const eta=(i===0&&!p.done)?estimatedFinishSeconds(p):null;
      const etaText=eta?` · 예상 ${eta.toFixed(2)}초`:"";

      c.no.textContent=String(rank);
      c.trend.textContent=trendText;
      c.team.textContent=p.team;
      c.team.className=`team-mini team-${p.team.toLowerCase()}`;
      c.name.textContent=p.name;
      c.gap.textContent=gapText+etaText;
      const displayMs=p.done ? p.finishTime : (raceStart?Math.max(0,(gameNow()-raceStart)):0);
      c.gap.className=`rank-gap ${rankingTimeClass(displayMs)}`;
      frag.appendChild(c.row);
    }
    // Existing nodes are simply reordered; listeners/DOM nodes are reused.
    rankingEl.appendChild(frag);
    renderRecordBoard();
    renderLiveRatings();
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
        <div><b>${p.name}</b><span>${teamLabel(p.team)} · ${styleLabel(p.drivingStyle.style)}</span><small>OVR ${overallOf(p)}</small></div>
      </div>
      <div class="profileSummary">
        <div><b>소속팀</b><span>${teamLabel(p.team)}</span></div>
        <div><b>주행 성향</b><span>${styleLabel(p.drivingStyle.style)}</span></div>
        <div><b>AI 개성</b><span>${identitySummary(p)}</span></div>
        <div><b>시그니처</b><span>${personalitySummary759(p).signature}</span></div>
        <div><b>클러치</b><span>${Math.round(personalitySummary759(p).clutch*100)}</span></div>
        <div><b>현재 라이벌</b><span>${personalitySummary759(p).rival||"-"}</span></div>
        <div><b>현재 유닛</b><span>${unitChassis764().name} · ${unitChassis764().role}</span></div>
        <div><b>유닛 특성</b><span>속도 x${unitChassis764().topSpeed.toFixed(3)} · 충돌 ${unitChassis764().hitRadius.toFixed(2)}</span></div>
        <div><b>유닛 궁합</b><span>${unitCompatibility769(p).grade} · ${Math.round(unitCompatibility769(p).fit*100)}</span></div>
        <div><b>당일 컨디션</b><span>${p.raceForm>=1.025?"좋음":p.raceForm<=.975?"흔들림":"보통"}</span></div>
        <div><b>팀전 누적점수</b><span>${playerTournament[p.index]?.total||0}점</span></div>
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
    if(map.complete){
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
      .sort((a,b)=>b.avgRating-a.avgRating || a.avgRank-b.avgRank);

    const avg=(arr,key)=>arr.length?arr.reduce((s,x)=>s+x[key],0)/arr.length:0;
    const teamSummary={};
    for(const team of ["A","B","C","D"]){
      const rows=reports.filter(x=>x.team===team);
      teamSummary[team]={
        rating:avg(rows,"avgRating"),
        collisions:rows.reduce((s,x)=>s+x.collisions,0),
        overtakes:rows.reduce((s,x)=>s+x.overtakes,0)
      };
    }

    const allLeaderChanges=roundHistory.reduce((s,r)=>s+(r.leaderChanges||0),0);
    const allOvertakes=roundHistory.reduce((s,r)=>s+(r.totalOvertakes||0),0);
    const winner=teamWinner();
    const standings=teamStandings();
    let matchText;
    if(!winner){
      matchText=`4팀 최고점이 동률로 경기를 마쳤다. 빨강 ${teamTotals.A}점, 파랑 ${teamTotals.B}점, 노랑 ${teamTotals.C}점, 초록 ${teamTotals.D}점.`;
    }else{
      matchText=`${teamLabel(winner)}이 ${teamTotals[winner]}점으로 승리했다. `+
        `빨강 ${teamTotals.A}점, 파랑 ${teamTotals.B}점, 노랑 ${teamTotals.C}점, 초록 ${teamTotals.D}점.`;
    }
    matchText+=` 전체 5라운드 기준 선두교체 ${allLeaderChanges}회, 순위상승 ${allOvertakes}회를 기록했다.`;
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
              <div class="analysis-player">${avatarHtml(a.index,"analysis-avatar")}<div><span>${teamLabel(a.team)}</span><b>${a.name}</b></div></div>
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
    if(map.complete){
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
        <div class="podium-copy"><b>${pt.name}</b><span>${teamLabel(pt.team)}</span><strong>${pt.total>0?"+":""}${pt.total}점</strong><small>평점 ${rt?rt.rating.toFixed(1):"-"} · 추월 ${rt?.overtakes||0}</small></div>
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

    const winnerTeam=teamWinner();
    const winner=winnerTeam?`${teamLabel(winnerTeam)} 승리`:"무승부";
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
    const resultTeams=[
      {id:"A",name:"빨강팀",short:"빨강",color:"#ff4d4d",rgb:"255,77,77",score:teamTotals.A},
      {id:"B",name:"파랑팀",short:"파랑",color:"#4d8dff",rgb:"77,141,255",score:teamTotals.B},
      {id:"C",name:"노랑팀",short:"노랑",color:"#ffd84d",rgb:"255,216,77",score:teamTotals.C},
      {id:"D",name:"초록팀",short:"초록",color:"#39d46a",rgb:"57,212,106",score:teamTotals.D}
    ];
    const rankedTeams=[...resultTeams].sort((a,b)=>b.score-a.score);
    const minTeamScore=Math.min(...resultTeams.map(t=>t.score),0);
    const maxTeamScore=Math.max(...resultTeams.map(t=>t.score),1);
    const scoreSpan=Math.max(1,maxTeamScore-minTeamScore);
    const totalPositive=resultTeams.reduce((s,t)=>s+Math.max(0,t.score),0)||1;

    // Cumulative points by round for the line chart.
    const cumulative={A:[],B:[],C:[],D:[]};
    const running={A:0,B:0,C:0,D:0};
    roundHistory.forEach(r=>{
      for(const t of resultTeams){
        running[t.id]+=r.team[t.id]||0;
        cumulative[t.id].push(running[t.id]);
      }
    });
    const allCum=resultTeams.flatMap(t=>[0,...cumulative[t.id]]);
    const minCum=Math.min(0,...allCum),maxCum=Math.max(1,...allCum);
    const cumSpan=Math.max(1,maxCum-minCum);
    const chartW=640,chartH=190,padL=42,padR=18,padT=18,padB=32;
    const xAt=i=>padL+(chartW-padL-padR)*(i/5);
    const yAt=v=>padT+(chartH-padT-padB)*(1-(v-minCum)/cumSpan);
    const gridVals=[minCum,minCum+cumSpan*.25,minCum+cumSpan*.5,minCum+cumSpan*.75,maxCum];
    const lineSvg=`<svg class="team-result-line-svg" viewBox="0 0 ${chartW} ${chartH}" role="img" aria-label="라운드별 누적 팀 점수">
      ${gridVals.map(v=>`<line x1="${padL}" y1="${yAt(v).toFixed(1)}" x2="${chartW-padR}" y2="${yAt(v).toFixed(1)}" class="tr-grid"/><text x="${padL-8}" y="${(yAt(v)+4).toFixed(1)}" class="tr-axis" text-anchor="end">${Math.round(v)}</text>`).join("")}
      ${[1,2,3,4,5].map((r,i)=>`<text x="${xAt(i+1).toFixed(1)}" y="${chartH-9}" class="tr-axis" text-anchor="middle">${r}R</text>`).join("")}
      ${resultTeams.map(t=>{
        const vals=[0,...cumulative[t.id]];
        const pts=vals.map((v,i)=>`${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
        return `<polyline points="${pts}" fill="none" stroke="${t.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          ${vals.slice(1).map((v,i)=>`<circle cx="${xAt(i+1).toFixed(1)}" cy="${yAt(v).toFixed(1)}" r="5" fill="${t.color}" stroke="#07111d" stroke-width="2"><title>${t.name} ${i+1}R 누적 ${v}</title></circle>`).join("")}`;
      }).join("")}
    </svg>`;

    teamSummary.innerHTML=`<div class="team-result-hero">
        <div class="winner">${winnerTeam?`<span class="winner-dot team-result-${winnerTeam}"></span>${winner}`:winner}</div>
        <div class="team-result-rank-grid">${rankedTeams.map((t,i)=>{
          const pct=Math.max(8,((t.score-minTeamScore)/scoreSpan)*100);
          return `<div class="team-result-rank-card team-result-card-${t.id}" style="--team:${t.color};--team-rgb:${t.rgb}">
            <div class="tr-rank">${i+1}</div>
            <div class="tr-team-name"><span class="tr-color-dot"></span>${t.name}</div>
            <div class="tr-score">${t.score}</div>
            <div class="tr-score-track"><i style="width:${pct.toFixed(1)}%"></i></div>
          </div>`;
        }).join("")}</div>
      </div>

      <div class="team-result-dashboard">
        <section class="team-result-panel team-result-trend">
          <div class="team-result-head"><b>라운드별 누적 점수</b><span>흐름 한눈에 보기</span></div>
          ${lineSvg}
          <div class="tr-legend">${resultTeams.map(t=>`<span><i style="background:${t.color}"></i>${t.name}</span>`).join("")}</div>
        </section>

        <section class="team-result-panel">
          <div class="team-result-head"><b>라운드 점수 상세</b><span>팀 색상으로 구분</span></div>
          <div class="round-score-matrix">
            <div class="rsm-head"><span>팀</span>${roundHistory.map(r=>`<b>${r.round}R</b>`).join("")}<b>합계</b></div>
            ${resultTeams.map(t=>`<div class="rsm-row" style="--team:${t.color};--team-rgb:${t.rgb}">
              <strong><i></i>${t.short}</strong>
              ${roundHistory.map(r=>{
                const v=r.team[t.id]||0;
                return `<span class="${v>0?"plus":v<0?"minus":"zero"}">${v>0?"+":""}${v}</span>`;
              }).join("")}
              <b>${t.score>0?"+":""}${t.score}</b>
            </div>`).join("")}
          </div>
        </section>
      </div>

      <div class="team-result-share">
        <div class="team-result-head"><b>양수 점수 점유율</b><span>팀별 최종 점수 비중</span></div>
        <div class="tr-share-bar">${resultTeams.map(t=>{
          const w=Math.max(0,t.score)/totalPositive*100;
          return `<i style="width:${w.toFixed(2)}%;background:${t.color}" title="${t.name} ${w.toFixed(1)}%"></i>`;
        }).join("")}</div>
        <div class="tr-share-labels">${resultTeams.map(t=>{
          const w=Math.max(0,t.score)/totalPositive*100;
          return `<span style="--team:${t.color}"><i></i><b>${t.name}</b> ${w.toFixed(1)}%</span>`;
        }).join("")}</div>
      </div>`;

    const rows=Object.values(playerTournament).sort((a,b)=>b.total-a.total || a.name.localeCompare(b.name));
    body.innerHTML=rows.map((pt,i)=>{
      const r=[1,2,3,4,5].map(n=>{
        const x=pt.rounds.find(v=>v.round===n);
        return x ? `${x.rank}위 / ${x.points>0?"+":""}${x.points}` : "-";
      });
      return `<tr>
        <td>${i+1}</td>
        <td><span class="team-mini team-${pt.team.toLowerCase()}">${pt.team}</span></td>
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
  startBtn.addEventListener("click",start);
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

  function v36SelfAudit(){
    const issues=[];
    if(names.length!==12||new Set(names).size!==12)issues.push("선수12");
    if(OBSERVER_COUNT!==130)issues.push("옵저버130");
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
    if(MAP_POOL_770.some(m=>m.id!=="s_map"&&m.roadFollowMode778!=="route-center-hard"))issues.push("하드경로778");
    if(!MAP_DEFINITIONS_770.ice_ring?.hardForbidden780)issues.push("아이스금지구역780");
    if(!MAP_DEFINITIONS_770.industrial_zone?.hardForbidden780||(MAP_DEFINITIONS_770.industrial_zone.forbiddenZones770||[]).length!==3)issues.push("롤링스톤바위780");
    if(!MAP_DEFINITIONS_770.industrial_zone?.boulderBypass789)issues.push("롤링스톤우회789");
    if(MAP_POOL_770.some(m=>m.id!=="s_map"&&!m.approvedImageShape772))issues.push("확정맵이미지");
    if(!currentMap770().geometryReady||route.length<2||RACING_SPLINE_720.length<2)issues.push("맵지오메트리");
    if(MAP_POOL_770.length!==9)issues.push("9맵구성777");
    if(!["s_map","star_fish","ice_ring","desert_oasis","neon_city","double_hairpin","skyway","cliff_hanger","industrial_zone"].every(id=>MAP_DEFINITIONS_770[id]))issues.push("맵목록777");
    if(MAP_POOL_770.some(m=>!m.logicalSize||!m.miniCrop||!m.route770?.length))issues.push("맵geometry777");
    if(MAP_POOL_770.some(m=>!m.outerSoftLimit789||!m.insideTune789))issues.push("전역인코스789");
    if(!MAP_DEFINITIONS_770.skyway?.spaceRoadRowsAdded788||MAP_DEFINITIONS_770.skyway.spaceRoadRowsAdded788!==2)issues.push("스페이스폭788");
    if(Math.hypot((MAP_DEFINITIONS_770.double_hairpin?.start?.x||0)-20.007,(MAP_DEFINITIONS_770.double_hairpin?.start?.y||0)-149.930)>.05)issues.push("블랙홀시작7892");
    if(Math.hypot((MAP_DEFINITIONS_770.double_hairpin?.goal?.x||0)-78.738,(MAP_DEFINITIONS_770.double_hairpin?.goal?.y||0)-95.661)>.05)issues.push("블랙홀도착7892");
    if(!MAP_DEFINITIONS_770.double_hairpin?.leftDuplicateGateRemoved892||MAP_DEFINITIONS_770.double_hairpin?.startDirection892!=="right")issues.push("블랙홀경로7892");
    const u764=unitChassis764();
    if(Object.keys(UNIT_CHASSIS_764).length!==5)issues.push("유닛5");
    if(UNIT_CHASSIS_764[1].hitRadius>=Math.min(...Object.values(UNIT_CHASSIS_764).slice(1).map(x=>x.hitRadius)))issues.push("스커지크기");
    if(UNIT_CHASSIS_764[1].topSpeed<=Math.max(...Object.values(UNIT_CHASSIS_764).slice(1).map(x=>x.topSpeed)))issues.push("스커지속도");
    if(unitSpeedSpread764().spreadPct>1.5)issues.push("속도격차");
    if(!(u764.hitRadius>=.47&&u764.hitRadius<=.63))issues.push("HIT");
    // v4.08: generous outer survival buffer; no physical wall exists.
    if(Math.abs((1+.03)-1.03)>.0001)issues.push("가속도3");
    if(Math.abs(PLAYER_VISUAL_SCALE-.6583842)>.0001||Math.abs(OBS_VISUAL_SCALE-.851598)>.0001)issues.push("기본크기");
    if(!(UNIT_CHASSIS_764[1].visualScale<UNIT_CHASSIS_764[3].visualScale&&UNIT_CHASSIS_764[5].visualScale>1))issues.push("유닛표현");
    if(STUN_MS!==0||INV_MS!==0)issues.push("즉사규칙");
    if(ROUND_POINTS.length!==12)issues.push("점수12");
    if(!["HongKey","TaeHyeon","DVA","LiveCam"].every(n=>names.includes(n)))issues.push("추가선수");
    if(!unitSprites[1]?.D||!unitSprites[5]?.D)issues.push("4팀스프라이트");
    return {ok:!issues.length,issues,build:BUILD_ID};
  }

  window.ObserverFMRaceEngine={
    version:BUILD_ID,selfAudit:v36SelfAudit,
    getPerformance:()=>({fps:diagFps,frameMs:diagFrameMs,maxFrameMs:diagMaxFrameMs,fpsProtectLevel}),
    schema:"observer-fm-race-result@1",
    getRules:()=>clonePlain(engineCoreRules()),
    getLastResult:()=>lastMasterResult?clonePlain(lastMasterResult):null,
    getCurrentState:()=>({build:BUILD_ID,running,paused,currentRound,simClock,
      mapId:currentMap770().id,mapName:currentMap770().name,
      teamScores:{A:teamTotals.A,B:teamTotals.B,C:teamTotals.C,D:teamTotals.D},finished:players.filter(p=>p.done).length}),
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
      outerSoftRecoveries789:p._outerSoftRecoveries789||0,
      events:(p._teleportEvents754||[]).map(x=>({...x})),
      splineProgress:p._splineProg720||0,mode:p._raceState720?.mode||"NORMAL",
      action:p._raceState720?.action||"none",x:p.x,y:p.y
    }))
  };

  map.addEventListener("load",()=>{
    reset();
    syncMapSelect774();
    lastMiniMapRender=0;
    renderMiniMap(true);
  });
  if(map.complete){
    reset();
    syncMapSelect774();
    lastMiniMapRender=0;
    renderMiniMap(true);
  }

  window.ObserverFMStats = { advancedStats697, getAll:()=>players.map(p=>({name:p.name,...(advancedStats697(p)||{})})) };
})();
