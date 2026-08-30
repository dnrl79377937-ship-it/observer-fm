
(() => {
  "use strict";

  const canvas = document.getElementById("race");
  const ctx = canvas.getContext("2d");
  const rankingEl = document.getElementById("rankingList");
  const clockEl = document.getElementById("clock");
  const cameraLabel = document.getElementById("cameraLabel");
  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");

  const MAP_W = 257, MAP_H = 178;
  const OBSERVER_COUNT = 650;
  const HIT_CHANCE = 1.00;
  const STUN_MS = 2000;
  const INV_MS = 1000;
  const CAMERA_ZOOM = 3.0;
  const BUILD_ID = "v32.5";
window.__OBSERVER_FM_BUILD__ = BUILD_ID;

  const unitSprites={
    1:{A:new Image(),B:new Image()},
    2:{A:new Image(),B:new Image()},
    3:{A:new Image(),B:new Image()}
  };
  unitSprites[1].A.src="scourge_a.png"; unitSprites[1].B.src="scourge_b.png";
  unitSprites[2].A.src="scout_a.png";   unitSprites[2].B.src="scout_b.png";
  unitSprites[3].A.src="wraith_a.png";  unitSprites[3].B.src="wraith_b.png";


  // Engine safeguards. Visual sprite size is independent of collision radius.
  const PLAYER_HIT_RADIUS = 0.36;     // unchanged collision feel
  const PLAYER_VISUAL_SCALE = 0.69292265625;   // v14 visual size
  const OBS_VISUAL_SCALE = 0.51;      // v14 visual size
  const OBS_SPEED_RATIO = 0.684;         // observer speed ≈ 90% of player speed
  const OBS_WANDER_RANGE = 0.88;        // legacy value (not used for full-map roam)
  const OBS_MOVE_MS = 10000;            // move for 10 seconds
  const OBS_STOP_MS = 1000;             // then stop for 1 second
  const AVOID_SCAN_RADIUS = 34.0;        // look ahead for nearby observers
  const AVOID_CRITICAL_RADIUS = 9.5;     // emergency reaction zone
  const AVOID_PREDICT_SEC = 3.20;        // predict observer positions ahead
  const AVOID_REACTION_CHANCE = 0.9995;  // much stronger reaction rate
  const AVOID_SAFE_BUFFER = 6.2;
  const AVOID_LANE_LOOKAHEAD = 2.60;
  const AVOID_HORIZONS = [0.42,0.95,1.70,2.85];   // compare future lane safety
  const INSIDE_CORNER_STRENGTH = 0.998; // Kart-style inside apex bias
        // extra body-size safety margin
  const ROAD_MARGIN = 0.90;           // keep units inside the drivable corridor
  const STUCK_RESCUE_MS = 2200;       // recover from pathological steering states

  const names = ["Angel","Egle","GhostRider","Bacilius","Zino","Chotbul","Kaka","Pika"];
  const colors = ["#66e3ff","#ffdb66","#ff7a8a","#9b8cff","#72f0a7","#ff9f5c","#f275ff","#b6f06e"];

  // v29: 20 FM-style attributes + individual driving personality.
  // Values are fixed for this build so a player's identity does not reroll on refresh.
  const playerStats = [
    {pace:75,acceleration:95,cornering:82,insideLine:78,routeReading:74,avoidance:83,reaction:91,prediction:96,control:79,stability:98,braking:98,recovery:99,consistency:98,focus:90,aggression:95,riskControl:87,pressure:81,start:97,endurance:79,luck:96}, // Angel
    {pace:78,acceleration:92,cornering:97,insideLine:82,routeReading:94,avoidance:98,reaction:88,prediction:73,control:73,stability:74,braking:85,recovery:77,consistency:81,focus:86,aggression:98,riskControl:94,pressure:75,start:92,endurance:80,luck:96}, // Egle
    {pace:86,acceleration:97,cornering:75,insideLine:79,routeReading:72,avoidance:95,reaction:81,prediction:80,control:73,stability:82,braking:92,recovery:97,consistency:81,focus:95,aggression:75,riskControl:96,pressure:77,start:87,endurance:97,luck:97}, // GhostRider
    {pace:82,acceleration:95,cornering:94,insideLine:97,routeReading:93,avoidance:84,reaction:90,prediction:88,control:93,stability:77,braking:83,recovery:84,consistency:92,focus:72,aggression:85,riskControl:84,pressure:94,start:93,endurance:76,luck:74}, // Bacilius
    {pace:88,acceleration:90,cornering:97,insideLine:74,routeReading:84,avoidance:88,reaction:76,prediction:99,control:93,stability:96,braking:83,recovery:97,consistency:76,focus:84,aggression:97,riskControl:84,pressure:98,start:93,endurance:94,luck:93}, // Zino
    {pace:74,acceleration:97,cornering:91,insideLine:75,routeReading:84,avoidance:84,reaction:76,prediction:88,control:86,stability:98,braking:86,recovery:88,consistency:77,focus:93,aggression:94,riskControl:83,pressure:89,start:94,endurance:77,luck:76}, // Chotbul
    {pace:88,acceleration:94,cornering:74,insideLine:94,routeReading:88,avoidance:91,reaction:78,prediction:99,control:97,stability:95,braking:96,recovery:96,consistency:82,focus:84,aggression:99,riskControl:84,pressure:83,start:96,endurance:86,luck:88}, // Kaka
    {pace:83,acceleration:98,cornering:96,insideLine:98,routeReading:90,avoidance:94,reaction:86,prediction:95,control:80,stability:96,braking:72,recovery:83,consistency:79,focus:88,aggression:90,riskControl:96,pressure:89,start:85,endurance:81,luck:99}, // Pika
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
  ];

  const profiles = playerStats.map(s => ({
    pace:s.pace,
    line:Math.round((s.cornering+s.insideLine+s.routeReading)/3),
    control:Math.round((s.control+s.stability+s.reaction)/3),
    aggression:s.aggression
  }));

  // Centerline based on the user's supplied map.
  const route = [
    [21,158],[44,158],[73,158],[104,158],[130,157],[143,151],
    [148,139],[148,121],[147,103],[139,91],[127,85],[111,83],
    [101,88],[98,99],[89,105],[73,108],[54,108],[36,108],[23,105],
    [20,94],[20,78],[20,61],[21,43],[27,28],[40,20],[57,18],
    [70,19],[78,26],[81,34],[93,36],[111,35],[130,34],[145,34],[154,34]
  ];

  // Tuned road half widths. We keep controls constrained to the visible road.
  const widths = route.map((_, i) => {
    if (i < 6) return 9.5;
    if (i < 13) return 7.0;
    if (i < 21) return 8.2;
    if (i < 28) return 7.0;
    return 7.8;
  });

  const segs = [];
  let routeLength = 0;
  for (let i=0;i<route.length-1;i++){
    const a=route[i], b=route[i+1];
    const dx=b[0]-a[0], dy=b[1]-a[1];
    const L=Math.hypot(dx,dy) || 1;
    segs.push({a,b,dx,dy,L,ux:dx/L,uy:dy/L,nx:-dy/L,ny:dx/L,start:routeLength});
    routeLength += L;
  }

  const map = new Image();
  map.src = "map.png";

  let players = [];
  let observers = [];
  let running = false;
  let raceStart = 0;
  let lastTs = 0;
  let raf = 0;
  let camX = 28, camY = 158;

  const ROUND_POINTS=[10,7,5,3,2,1,0,-3];
  let currentRound=1;
  let teamAssignments={};
  let teamTotals={A:0,B:0};
  let playerTournament={};
  let roundHistory=[];
  let roundTransitioning=false;

  function shuffledIndexes(){
    const arr=[0,1,2,3,4,5,6,7];
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function createTeams(){
    teamAssignments={};
    const order=shuffledIndexes();
    order.forEach((idx,pos)=>teamAssignments[idx]=pos<4?"A":"B");
  }

  function initTournament(){
    currentRound=1;
    teamTotals={A:0,B:0};
    roundHistory=[];
    playerTournament={};
    names.forEach((name,i)=>{
      playerTournament[i]={name,team:teamAssignments[i],total:0,rounds:[]};
    });
  }

  function teamLabel(team){ return team==="A" ? "A팀" : "B팀"; }


  function safeAt(x,y){
    return (
      (x>=7 && x<=38 && y>=143 && y<=172) ||
      (x>=7 && x<=38 && y>=93 && y<=123) ||
      (x>=140 && x<=168 && y>=20 && y<=46)
    );
  }

  function makePlayers(){
    return names.map((name,i)=>{
      const pf=profiles[i];
      const stats=playerStats[i];
      const drivingStyle=drivingStyles[i];
      const paceNorm=(pf.pace-90)/10;
      return {
        index:i,name,color:colors[i],profile:pf,stats,drivingStyle,team:teamAssignments[i]||"A",
        x:20.5, y:154.8 + (i-3.5)*0.48,
        seg:0,
        // Pace creates small but meaningful differences, not runaway gaps.
        speed: (
          9.43
          + paceNorm*0.31
          + ((stats.acceleration-85)/14)*0.075
          + ((stats.consistency-85)/14)*0.045
          + ((stats.endurance-85)/14)*0.030
          + ((stats.luck-85)/14)*0.012
          + Math.random()*0.035
        ) * 1.267875,
        desiredOffset:(i-3.5)*0.48,
        stunUntil:0, invUntil:0, collisionLockUntil:0,
        hitFxUntil:0, visualAngle:0, prevX:route[0][0], prevY:route[0][1],
        sectorIndex:0, sectorStartMs:0, sectorTimes:[],
        hits:0, done:false, finishTime:null,
        controlMode:"normal", controlUntil:0,
        controlCooldown: 2400 + Math.random()*3600,
        modeStart:0,
        lastProgress:0,
        lastAdvanceAt:0,
        lastX:20.5,
        lastY:154.8 + (i-3.5)*0.48,
        avoidDecisionUntil:0,
        avoidWillDodge:true,
        avoidThreatId:-1,
        avoidPlanOffset:0,
        avoidPlanSpeedMul:1,
        avoidPlanUntil:0,
        avoidPlanRisk:0,
        packPlanOffset:0,
        packPlanUntil:0,
        resumeEaseUntil:0,
        match:{
          collisions:0,stops:0,avoids:0,overtakes:0,leadMs:0,
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

  function spawnObservers(){
    const arr=[];
    const avgPlayerSpeed=9.72;
    const baseSpeed=avgPlayerSpeed*OBS_SPEED_RATIO;

    for(let i=0;i<OBSERVER_COUNT;i++){
      const o={
        id:i,
        x:3.5+Math.random()*(MAP_W-7),
        y:3.5+Math.random()*(MAP_H-7),
        vx:0, vy:0,
        speed:baseSpeed*(0.98+Math.random()*0.04),
        phase:"move",
        phaseUntil:0,
        // Stagger phases so 600 observers do not stop simultaneously.
        cycleOffset:Math.random()*(OBS_MOVE_MS+OBS_STOP_MS)
      };
      pickObserverLeg(o);
      arr.push(o);
    }
    return arr;
  }

  function resetRound(){
    cancelAnimationFrame(raf);
    players=makePlayers();
    observers=spawnObservers();
    running=false;
    raceStart=0; lastTs=0; lastRankingRender=0; simClock=0; simAccumulator=0;
    lastLeaderName=""; raceEventText=""; raceEventUntil=0; bestSector=[null,null,null];
    seasonRecorded=false; prevRanks=new Map();
    camX=28; camY=158;
    roundTransitioning=false;
    startBtn.textContent=`${currentRound}R 시작`;
    render(0);
    renderRanking();
    renderTeamScore();
  }

  function reset(){
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

  function start(){
    if(running) return;
    if(players.every(p=>p.done)) return;
    running=true;
    const now=performance.now();
    if(!raceStart) raceStart=now;
    lastTs=now;
    simClock=now; simAccumulator=0;
    rebuildObserverGrid();
    precomputeObserverPredictions();
    startBtn.textContent="진행 중";
    raf=requestAnimationFrame(loop);
  }

  function chooseControl(p, now, dt){
    p.controlCooldown -= dt;
    if(p.controlMode!=="normal" && now>=p.controlUntil){
      p.controlMode="normal";
    }
    if(p.controlMode==="normal" && p.controlCooldown<=0){
      // Higher aggression = more frequent manual-control attempts.
      // Higher control = shorter/cleaner execution with less time loss.
      const ag=(p.profile.aggression-60)/40;
      const ct=(p.profile.control-85)/15;
      const r=Math.random();

      if(r < 0.28) p.controlMode="zigzag";
      else if(r < 0.48) p.controlMode="backcon";
      else if(r < 0.68) p.controlMode="stopcon";
      else p.controlMode="wide";

      let duration =
        p.controlMode==="stopcon" ? 210+Math.random()*190 :
        p.controlMode==="backcon" ? 460+Math.random()*250 :
        600+Math.random()*440;

      duration *= (1.08 - ct*0.16);
      p.modeStart=now;
      p.controlUntil=now+duration;
      p.controlCooldown=(3900-ag*1200)+Math.random()*(4600-ag*800);
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
    const apex=0.68 + lineSkill*0.16;
    return (turn>0 ? 1 : -1)*half*apex;
  }

  function clampToRoad(p){
    const si=Math.min(p.seg,segs.length-1);
    const s=segs[si];

    // Project player onto current segment coordinates.
    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    let along=(rx*s.ux+ry*s.uy);
    let lateral=(rx*s.nx+ry*s.ny);

    // Keep enough room for special controls while never allowing wall/black-area escapes.
    const half=Math.max(1.8,widths[si]*ROAD_MARGIN);
    along=Math.max(-1.2,Math.min(s.L+2.2,along));
    lateral=Math.max(-half,Math.min(half,lateral));

    p.x=s.a[0]+s.ux*along+s.nx*lateral;
    p.y=s.a[1]+s.uy*along+s.ny*lateral;
  }

  function rescueIfStuck(p,now){
    const prog=currentProgress(p);
    if(prog > p.lastProgress + 0.18){
      p.lastProgress=prog;
      p.lastAdvanceAt=now;
      p.lastX=p.x; p.lastY=p.y;
      return;
    }

    if(!p.lastAdvanceAt) p.lastAdvanceAt=now;
    if(now-p.lastAdvanceAt < STUCK_RESCUE_MS) return;

    // Snap gently ahead on the current centerline instead of freezing forever.
    const si=Math.min(p.seg,segs.length-1);
    const s=segs[si];
    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    let along=rx*s.ux+ry*s.uy;
    along=Math.max(0,Math.min(s.L,along+1.8));
    p.x=s.a[0]+s.ux*along+s.nx*p.desiredOffset;
    p.y=s.a[1]+s.uy*along+s.ny*p.desiredOffset;
    p.controlMode="normal";
    p.controlUntil=0;
    p.lastProgress=currentProgress(p);
    p.lastAdvanceAt=now;
  }


  const OBS_GRID_SIZE = 22;
  const OBS_GRID_COLS = Math.ceil(MAP_W/OBS_GRID_SIZE);
  const OBS_GRID_ROWS = Math.ceil(MAP_H/OBS_GRID_SIZE);
  const observerGrid = Array.from({length:OBS_GRID_COLS*OBS_GRID_ROWS},()=>[]);

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

  const nearbyBufferPool = Array.from({length:8},()=>[]);
  const localPlayerBuffers = Array.from({length:8},()=>[]);
  const threatObserverBuffers = Array.from({length:8},()=>[]);
  const threatDistanceBuffers = Array.from({length:8},()=>[]);

  function nearestThreats(raw,p,limit=8){
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

  function predictedObserverX(o,t){
    const vx=o.phase==="move" ? (o.vx||0) : 0;
    return Math.max(2.5,Math.min(MAP_W-2.5,o.x+vx*t));
  }

  function predictedObserverY(o,t){
    const vy=o.phase==="move" ? (o.vy||0) : 0;
    return Math.max(2.5,Math.min(MAP_H-2.5,o.y+vy*t));
  }

  const OBS_PRED_X = AVOID_HORIZONS.map(()=>new Float32Array(OBSERVER_COUNT));
  const OBS_PRED_Y = AVOID_HORIZONS.map(()=>new Float32Array(OBSERVER_COUNT));

  function precomputeObserverPredictions(){
    for(let hi=0;hi<AVOID_HORIZONS.length;hi++){
      const t=AVOID_HORIZONS[hi];
      const px=OBS_PRED_X[hi], py=OBS_PRED_Y[hi];
      for(let i=0;i<observers.length;i++){
        const o=observers[i];
        const vx=o.phase==="move" ? (o.vx||0) : 0;
        const vy=o.phase==="move" ? (o.vy||0) : 0;
        let x=o.x+vx*t, y=o.y+vy*t;
        if(x<2.5) x=2.5; else if(x>MAP_W-2.5) x=MAP_W-2.5;
        if(y<2.5) y=2.5; else if(y>MAP_H-2.5) y=MAP_H-2.5;
        px[i]=x; py[i]=y;
      }
    }
  }


  function localPlayerContext(p,range=13){
    const out=localPlayerBuffers[p.index];
    out.length=0;
    const pp=currentProgress(p);
    for(let i=0;i<players.length;i++){
      const q=players[i];
      if(q===p || q.done) continue;
      const gap=currentProgress(q)-pp;
      if(gap>-4 && gap<range) out.push({q,gap});
    }
    return out;
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

  function cornerInsideSide(si){
    const i=Math.max(1,Math.min(route.length-2,si));
    const a=route[i-1], b=route[i], c=route[i+1];
    const v1x=b[0]-a[0], v1y=b[1]-a[1];
    const v2x=c[0]-b[0], v2y=c[1]-b[1];
    const cross=v1x*v2y-v1y*v2x;
    if(Math.abs(cross)<0.20) return 0;
    // Route normal convention: +off is right side, -off is left side.
    // Left turn => inside is left (-1); right turn => inside is right (+1).
    return cross>0 ? -1 : 1;
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
    // Positive screen Y is downward. For the opening 7→5 run we explicitly
    // target the upper wall before the vertical climb, because that is shorter.
    if(si>=0 && si<=2) return -0.78;
    if(si>=3 && si<=4) return -0.92;
    if(si>=5 && si<=6) return -0.98;
    if(si>=7 && si<=8) return -0.84;
    if(si>=9 && si<=10) return -0.55;
    return 0;
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

        if(d2<4.0) danger += (4.0-d2)*105;
        else if(d2<16.0) danger += (16.0-d2)*11.0;
        else if(d2<49.0) danger += (49.0-d2)*0.72;
        else if(d2<100.0) danger += (100.0-d2)*0.06;
      }
    }

    const timeLoss=(1-speedMul)*19.0;
    const detour=Math.abs(targetOff-p.desiredOffset)*0.34;
    return {score:danger+timeLoss+detour,minClear:Math.sqrt(minClearSq)};
  }

  function chooseAvoidance(p,s,now){
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

    const nearbyRaw=nearbyObservers(p.x,p.y,AVOID_SCAN_RADIUS);
    if(!nearbyRaw.length) return null;

    // Keep only the closest relevant threats in the expensive prediction matrix.
    // 660 observers remain simulated/rendered, but distant ones no longer multiply
    // avoidance cost for every racer.
    const nearby=nearestThreats(nearbyRaw,p,6);
    const corridorBias=escapeCorridorBias(p,s,nearby);

    // Fast pre-check. If nothing is remotely threatening, keep the racing line.
    let nearest=Infinity;
    let nearestFuture=Infinity;
    const px3=p.x+s.ux*p.speed*AVOID_PREDICT_SEC;
    const py3=p.y+s.uy*p.speed*AVOID_PREDICT_SEC;
    for(const o of nearby){
      const d=Math.hypot(o.x-p.x,o.y-p.y);
      if(d<nearest) nearest=d;
      const ox=predictedObserverX(o,AVOID_PREDICT_SEC);
      const oy=predictedObserverY(o,AVOID_PREDICT_SEC);
      const fdx=ox-px3, fdy=oy-py3;
      const fd=Math.sqrt(fdx*fdx+fdy*fdy);
      if(fd<nearestFuture) nearestFuture=fd;
    }
    if(nearest>15.5 && nearestFuture>12.0){
      p.avoidPlanUntil=0;
      return null;
    }

    const si=Math.min(p.seg,segs.length-1);
    const evadeSkill=(p.stats.avoidance+p.stats.reaction+p.stats.prediction)/3;
    const half=Math.max(3.6,widths[si]*(0.63+(evadeSkill-72)*0.0020)*p.drivingStyle.safety);

    // Candidate lanes + speed choices. The planner chooses the safest path that
    // costs the least race time. Stop is evaluated only as an emergency option.
    const laneFracs=[-0.92,-0.56,0,0.56,0.92];
    const movingSpeeds=[1.00,0.82,0.66];
    let best=null;

    for(const frac of laneFracs){
      const targetOff=frac*half;
      for(const sm of movingSpeeds){
        const r=candidateAvoidanceRisk(p,s,targetOff,sm,nearby);
        const candidate={
          mode:"planned",
          targetOff,
          speedMul:sm,
          score:r.score,
          minClear:r.minClear
        };
        if(!best || candidate.score<best.score) best=candidate;
      }
    }

    // Compare against stopping, but impose a substantial time-loss penalty so
    // the racer stops only when moving choices are genuinely unsafe.
    const stopRisk=candidateAvoidanceRisk(p,s,p.desiredOffset,0,nearby);
    const stopCandidate={
      mode:"stop",
      targetOff:p.desiredOffset,
      speedMul:0,
      score:stopRisk.score + 8.5
        + (p.drivingStyle.attack-1)*18
        - (p.drivingStyle.safety-1)*15
        + ((p.stats.braking-85)/14)*-2.2,
      minClear:stopRisk.minClear
    };

    const movingUnsafe=!best || best.minClear<1.15 || best.score>260;
    if(movingUnsafe && stopCandidate.score<best.score*1.12){
      best=stopCandidate;
    }

    // No meaningful danger: don't disturb the optimal racing line.
    if(best && best.minClear>8.8 && best.score<8.0 && nearest>10.5){
      p.avoidPlanUntil=0;
      return null;
    }

    // Persist 320–560 ms. Very dangerous situations re-plan sooner.
    const emergency=best.minClear<2.7 || nearest<5.0;
    const react=(p.stats.reaction+p.stats.prediction)/2;
    const smooth=(p.stats.control+p.stats.stability)/2;
    const baseHold=430+(smooth-85)*5;
    if(Math.abs(corridorBias)>.12){
      const roadHalf=Math.max(1.8,widths[Math.min(p.seg,widths.length-1)]*.55);
      best.targetOff=best.targetOff*.72+corridorBias*roadHalf*.28;
    }
    p.avoidPlanOffset=best.targetOff;
    p.avoidPlanSpeedMul=best.speedMul;
    p.avoidPlanRisk=best.score;
    p.match.avoids++;
    if(best.mode==="stop") p.match.stops++;
    p.avoidPlanUntil=now+(emergency
      ? Math.max(205,285-(react-85)*4)+Math.random()*75
      : Math.max(350,baseHold)+Math.random()*150);
    return best;
  }


  function packContextOffset(p,si,now){
    const s=segs[Math.min(si,segs.length-1)];
    const half=Math.max(1.8,widths[si]*0.56);

    if(now<p.packPlanUntil) return p.packPlanOffset;

    const context=localPlayerContext(p,12.5);
    let nearestAhead=null, nearestGap=999;
    for(let i=0;i<context.length;i++){
      const e=context[i];
      if(e.gap>0 && e.gap<nearestGap){ nearestAhead=e.q; nearestGap=e.gap; }
    }
    if(!nearestAhead){
      p.packPlanOffset=0;
      p.packPlanUntil=now+260;
      return 0;
    }

    const q=nearestAhead;
    const qOff=((q.x-s.a[0])*s.nx+(q.y-s.a[1])*s.ny);
    const myOff=((p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny);
    const aggression=(p.stats.aggression-72)/27;
    const pressure=(p.stats.pressure-72)/27;
    const control=(p.stats.control-72)/27;
    const inside=cornerInsideSide(si);

    // Prefer the open side. Opportunists/attackers exploit an open inside lane.
    let side=(qOff>=myOff)?-1:1;
    if(inside!==0 && Math.abs(qOff-inside*half)>half*.34 &&
       (p.drivingStyle.name==="opportunist" || p.drivingStyle.name==="attacker" || aggression>.62)){
      side=inside;
    }

    let commitment=.42;
    if(p.drivingStyle.name==="safeReader" || p.drivingStyle.name==="patient") commitment=.34;
    else if(p.drivingStyle.name==="attacker" || p.drivingStyle.name==="opportunist") commitment=.72;
    else if(p.drivingStyle.name==="controller") commitment=.48;
    commitment+=aggression*.10+pressure*.07+control*.04;
    if(nearestGap<4.0) commitment+=.10;

    p.packPlanOffset=side*half*Math.min(.92,commitment);
    p.packPlanUntil=now+300+Math.random()*170;
    return p.packPlanOffset;
  }

  function plannedRacingOffset(p,si,now){
    // Re-plan only a few times per second. This prevents rapid left/right
    // oscillation when racers overlap while still reacting early to corners.
    if(now < p.linePlanUntil) return p.linePlanOffset;

    const s=segs[si];
    const lineSkill=(p.stats.cornering+p.stats.insideLine+p.stats.routeReading)/3;
    const half=Math.max(1.8,widths[si]*(0.54+(lineSkill-72)*0.0017));

    // v31: when the local road is genuinely clear of observers, commit to a
    // near-wall Kart-style apex instead of wasting space in the middle.
    const cornerSide=cornerInsideSide(si);
    const cornerPower=cornerIntensity(si);
    const localObs=nearbyObservers(p.x,p.y,18.0);
    if(localObs.length===0 && cornerSide!==0 && cornerPower>0.055){
      p.linePlanOffset=cornerSide*half*0.995;
      p.linePlanUntil=now+300+Math.random()*100;
      return p.linePlanOffset;
    }

    const candidates=[-0.995,-0.68,-0.34,0,0.34,0.68,0.995];
    let bestOff=0;
    let bestScore=Infinity;

    const maxAhead=Math.min(segs.length-1,si+5);
    for(const c of candidates){
      const off=c*half;
      let px=p.x, py=p.y;
      let score=0;

      // Cost of getting from the current position onto this candidate line.
      const entryX=s.b[0]+s.nx*off;
      const entryY=s.b[1]+s.ny*off;
      score += Math.hypot(entryX-px,entryY-py);
      px=entryX; py=entryY;

      // Look through several future segments and compare total path length.
      // Candidate offsets progressively prepare for the next apex.
      for(let j=si+1;j<=maxAhead;j++){
        const seg=segs[j];
        const prev=segs[Math.max(si,j-1)];
        const next=segs[Math.min(segs.length-1,j+1)];
        const turn=prev.ux*next.uy-prev.uy*next.ux;
        const h=Math.max(1.6,widths[j]*0.56);

        let futureOff=off*0.52;
        if(Math.abs(turn)>0.025){
          // Evaluate the physically shorter inside line for the upcoming corner.
          const inside=(turn>0 ? 1 : -1);
          futureOff=inside*h*0.96;
        }

        const wx=seg.b[0]+seg.nx*futureOff;
        const wy=seg.b[1]+seg.ny*futureOff;
        score += Math.hypot(wx-px,wy-py);
        px=wx; py=wy;
      }

      // Strong opening shortcut: 7→5 should ride the upper wall because the
      // following road turns upward. In screen coordinates, upper = smaller y.
      if(si<=8){
        const projectedY=s.b[1]+s.ny*off;
        score += Math.max(0,projectedY-151.2)*2.8;
        score -= Math.max(0,154.5-projectedY)*0.65;
      }

      // Avoid wall scraping while still allowing near-apex lines.
      score += Math.pow(Math.abs(c),5)*0.28;

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

  function optimizedLookAheadTarget(p,si,now){
    const maxAhead=Math.min(segs.length-1,si+4);
    const plannedOff=plannedRacingOffset(p,si,now);

    // Aim farther ahead than one centerline point. This is what lets the racer
    // cut a smooth diagonal instead of following the polyline point-by-point.
    let ahead=Math.min(segs.length-1,si+2);
    let strongest=0;
    for(let j=si+1;j<=maxAhead;j++){
      const a=segs[Math.max(0,j-1)];
      const b=segs[j];
      const turn=a.ux*b.uy-a.uy*b.ux;
      if(Math.abs(turn)>Math.abs(strongest)){
        strongest=turn;
        ahead=j;
      }
    }

    const targetSeg=segs[ahead];
    let targetOff=plannedOff*0.58;
    if(Math.abs(strongest)>0.02){
      const half=Math.max(1.7,widths[ahead]*0.58);
      targetOff=(strongest>0 ? 1 : -1)*half*0.985;
    }

    let x=targetSeg.b[0]+targetSeg.nx*targetOff;
    let y=targetSeg.b[1]+targetSeg.ny*targetOff;

    // Explicit opening racing line. The route immediately after 5 o'clock turns
    // upward, so this keeps the approach on the upper boundary instead of dropping.
    if(si<=8){
      const progress=Math.max(0,Math.min(1,(p.x-20.5)/(148-20.5)));
      const upperY=152.0 - 4.2*Math.pow(progress,0.78);
      y=Math.min(y,upperY);
    }

    return {x,y,off:plannedOff};
  }

  function updatePlayer(p, now, dt){
    if(p.done) return;

    if(now < p.stunUntil) return;
    if(p.stunUntil){
      p.stunUntil=0;
      p.invUntil=now+INV_MS;
      p.lastAdvanceAt=now;
      p.lastProgress=currentProgress(p);
      const recovery=(p.stats.recovery-72)/27;
      p.resumeEaseUntil=now+(470-recovery*150);
    }

    chooseControl(p,now,dt);

    const si=Math.min(p.seg,segs.length-1);
    const s=segs[si];
    const half=widths[si]*0.72;
    let targetOff=optimalOffsetFor(p);
    const plannedOff=plannedRacingOffset(p,si,now);
    const packOff=packContextOffset(p,si,now);
    // Ability-based line plus a persistent pack decision. This makes racers
    // separate naturally in close battles without physics-pushing each other.
    const packWeight=Math.min(0.34,0.12+(p.drivingStyle.pack-0.90)*0.55);
    targetOff=targetOff*0.18+plannedOff*(0.82-packWeight)+packOff*packWeight;
      // Kart-style cornering: aggressively approach the inside/apex on turns.
      const insideSide=cornerInsideSide(si);
      const turnPower=cornerIntensity(si);
      if(insideSide!==0 && turnPower>0.055){
        const halfRoad=Math.max(1.8,widths[si]*0.58);
        const apexOff=insideSide*halfRoad*INSIDE_CORNER_STRENGTH;
        const apexBlend=Math.min(0.999,0.76+turnPower*2.10);
        targetOff=targetOff*(1-apexBlend)+apexOff*apexBlend;
      }

      // Look ahead several route segments so the racer hugs the inside wall before
      // the corner actually begins instead of waiting until the midpoint.
      const futureInside=futureInsideBias(si);
      if(Math.abs(futureInside)>0.10){
        const halfRoad2=Math.max(1.8,widths[si]*0.59);
        const futureApex=futureInside*halfRoad2*0.998;
        targetOff=targetOff*0.15+futureApex*0.85;
      }

    // Lower line skill adds slightly more steering error, while everyone still
    // follows the optimized racing line most of the time.
    const lineError=(100-p.profile.line)/100;
    const precision=(p.stats.insideLine+p.stats.cornering+p.stats.routeReading)/300;
    const precisionNoise=0.010+(1-precision)*0.20;
    targetOff += Math.sin((now/1000)*0.7+p.index*1.3)*half*precisionNoise;

    // High inside-line racers visibly hold a tighter apex; lower line skill leaves
    // a little more safety margin, making player identities readable in motion.
    const insideNow=cornerInsideSide(si);
    if(insideNow!==0 && cornerIntensity(si)>0.06){
      const insideCommit=(p.stats.insideLine-72)/27;
      const styleApex=(p.drivingStyle.name==="attacker"||p.drivingStyle.name==="apexHunter")?.045:
        (p.drivingStyle.name==="safeReader"||p.drivingStyle.name==="patient")?-.035:0;
      const skillApex=insideNow*half*Math.min(.995,0.72+insideCommit*0.25+styleApex);
      targetOff=targetOff*(0.40-insideCommit*0.12)+skillApex*(0.60+insideCommit*0.12);
    }

    let speedMul=1;
    const controlSkill=(p.profile.control-85)/15;

    // Predictive v26 avoidance: compare future lanes and speeds, then hold the
    // selected plan briefly. This avoids both collisions and left/right twitching.
    const avoid=chooseAvoidance(p,s,now);
    if(avoid){
      if(avoid.mode==="stop"){
        speedMul=0;
      }else{
        const urgency=Math.max(0,Math.min(1,(80-(avoid.risk||0))/80));
        targetOff=targetOff*0.12+avoid.targetOff*0.88;
        speedMul=avoid.speedMul;
      }
    }
    if(!avoid && p.avoidPlanUntil && now>=p.avoidPlanUntil){
      // Once the threat is gone, recover the optimal racing line promptly instead
      // of drifting on the old evasive lane.
      p.avoidPlanOffset=targetOff;
      p.avoidPlanSpeedMul=1;
      p.avoidPlanRisk=0;
      p.avoidPlanUntil=0;
    }
    if(!avoid && p.controlMode==="zigzag"){
      targetOff += Math.sin(now*0.020+p.index)*half*(0.50+controlSkill*0.10);
      speedMul=0.925+controlSkill*0.055;
    } else if(!avoid && p.controlMode==="backcon"){
      const elapsed=now-p.modeStart;
      targetOff += Math.sin(now*0.024+p.index)*half*(0.39+controlSkill*0.08);
      const reverseMs=300-controlSkill*90;
      speedMul = elapsed<reverseMs ? (-0.32+controlSkill*0.06) : (1.11+controlSkill*0.08);
    } else if(!avoid && p.controlMode==="stopcon"){
      speedMul=0;
    } else if(!avoid && p.controlMode==="wide"){
      targetOff += (p.index%2?1:-1)*half*(0.56+controlSkill*0.08);
      speedMul=0.875+controlSkill*0.065;
    }
targetOff=Math.max(-half,Math.min(half,targetOff));
    p.desiredOffset += (targetOff-p.desiredOffset)*Math.min(0.095,dt*0.0035);

    // Look ahead to create smoother apex cutting.
    const next=segs[Math.min(segs.length-1,si+1)];
    let tx=s.b[0]+s.nx*p.desiredOffset;
    let ty=s.b[1]+s.ny*p.desiredOffset;
    const optTarget=optimizedLookAheadTarget(p,si,now);
    const optBlend = si<=8 ? 0.90 : 0.62;
    tx=tx*(1-optBlend)+optTarget.x*optBlend;
    ty=ty*(1-optBlend)+optTarget.y*optBlend;

    if(next && si<segs.length-1){
      const look=si<=8 ? 0.035 : 0.14;
      const nx=next.b[0]+next.nx*p.desiredOffset;
      const ny=next.b[1]+next.ny*p.desiredOffset;
      tx=tx*(1-look)+nx*look;
      ty=ty*(1-look)+ny*look;
    }

    let dx=tx-p.x, dy=ty-p.y;
    const d=Math.hypot(dx,dy) || 1;
    const step=p.speed*speedMul*dt/1000;
    const move=step>=0 ? Math.min(step,d) : Math.max(step,-0.55);
    p.x += dx/d*move;
    p.y += dy/d*move;

    // Never allow AI steering to drift into black/non-drivable areas.
    clampToRoad(p);
    p.match.distance += Math.hypot(p.x-p.match.lastX,p.y-p.match.lastY);
    p.match.lastX=p.x;
    p.match.lastY=p.y;

    // Robust segment advancement: crossing the end plane OR entering the next joint zone.
    // A short while-loop handles high FPS drops without skipping/sticking.
    let advances=0;
    while(p.seg<segs.length-1 && advances<3){
      const cs=segs[p.seg];
      const rx=p.x-cs.a[0], ry=p.y-cs.a[1];
      const alongPx=rx*cs.ux+ry*cs.uy;
      const endDx=p.x-cs.b[0], endDy=p.y-cs.b[1];
      const nearEnd=endDx*endDx+endDy*endDy<11.56;
      if(alongPx>=cs.L*0.91 || nearEnd){
        p.seg++;
        advances++;
      } else break;
    }

    // Final section: once the finish gate is reached/passed, finish immediately.
    const last=route[route.length-1];
    const fs=segs[segs.length-1];
    const frx=p.x-fs.a[0], fry=p.y-fs.a[1];
    const finishAlong=frx*fs.ux+fry*fs.uy;
    const finishDx=p.x-last[0], finishDy=p.y-last[1];
    if(p.seg>=segs.length-1 && (finishAlong>=fs.L*0.88 || finishDx*finishDx+finishDy*finishDy<38.44)){
      p.done=true;
      p.finishTime=now-raceStart;
      return;
    }

    rescueIfStuck(p,now);

    // Collision check: actual contact = guaranteed stop outside invincible safe zones.
    if(!safeAt(p.x,p.y) && now>=p.invUntil && now>=p.collisionLockUntil){
      for(const o of nearbyObservers(p.x,p.y,PLAYER_HIT_RADIUS+1.0)){
        if(Math.abs(o.x-p.x)>PLAYER_HIT_RADIUS || Math.abs(o.y-p.y)>PLAYER_HIT_RADIUS) continue;
        const cdx=p.x-o.x, cdy=p.y-o.y;
        if(cdx*cdx+cdy*cdy<PLAYER_HIT_RADIUS*PLAYER_HIT_RADIUS){
          p.hits++;
          p.hitFxUntil=now+240;
          p.stunUntil=now+STUN_MS;
          p.collisionLockUntil=now+STUN_MS+INV_MS;
          p.match.collisions++;
          p.lastAdvanceAt=p.stunUntil;
          p.avoidPlanUntil=0;
          break;
        }
      }
    }
  }

  function updateObservers(now,dt=16){
    const sec=Math.min(0.05,Math.max(0,dt/1000));
    const margin=2.8;

    for(const o of observers){
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
          pickObserverLeg(o);
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
  const SECTOR_MARKS=[0.25,0.50,0.75];
  let bestSector=[null,null,null];

  function updateCamera(dt){
    let top=null, topProg=-Infinity;
    let held=null, heldProg=-Infinity;
    let second=null, secondProg=-Infinity;

    for(let i=0;i<players.length;i++){
      const p=players[i];
      if(p.done) continue;
      const prog=currentProgress(p);
      if(p.index===cameraLeaderId){ held=p; heldProg=prog; }
      if(prog>topProg){
        second=top; secondProg=topProg;
        top=p; topProg=prog;
      }else if(prog>secondProg){
        second=p; secondProg=prog;
      }
    }
    if(!top) return;

    const now=performance.now();
    let leader=top, leaderProg=topProg;
    if(held && now<cameraLeaderHoldUntil && topProg-heldProg<8.0){
      leader=held; leaderProg=heldProg;
    }
    if(!held || (leader===top && top.index!==cameraLeaderId)){
      cameraLeaderId=leader.index;
      cameraLeaderHoldUntil=now+1100;
    }

    let tx=leader.x, ty=leader.y;
    let followSecond=second;
    let followSecondProg=secondProg;
    if(leader!==top){
      followSecond=top; followSecondProg=topProg;
    }
    if(followSecond && Math.abs(leaderProg-followSecondProg)<1.6){
      tx=leader.x*.90+followSecond.x*.10;
      ty=leader.y*.90+followSecond.y*.10;
    }else{
      // Broadcast cut: when 2nd/3rd are in a tighter fight than the leader,
      // let the camera lean toward that battle without abandoning race context.
      let ranks=[];
      for(let i=0;i<players.length;i++){
        if(!players[i].done) ranks.push({p:players[i],prog:currentProgress(players[i])});
      }
      ranks.sort((a,b)=>b.prog-a.prog);
      if(ranks.length>=3){
        const gap12=ranks[0].prog-ranks[1].prog;
        const gap23=ranks[1].prog-ranks[2].prog;
        if(gap23<0.9 && gap12>2.4){
          tx=ranks[1].p.x*.55+ranks[2].p.x*.45;
          ty=ranks[1].p.y*.55+ranks[2].p.y*.45;
        }
      }
    }
    const a=Math.min(0.085,dt*0.0028);
    camX+=(tx-camX)*a; camY+=(ty-camY)*a;
  }

  function finalizeRound(){
    if(roundTransitioning) return;
    roundTransitioning=true;

    const ordered=[...players].sort((a,b)=>a.finishTime-b.finishTime);
    const result={round:currentRound,team:{A:0,B:0},players:[]};

    ordered.forEach((p,idx)=>{
      const pts=ROUND_POINTS[idx];
      const team=p.team;
      result.team[team]+=pts;
      teamTotals[team]+=pts;
      playerTournament[p.index].total+=pts;
      playerTournament[p.index].rounds.push({round:currentRound,rank:idx+1,points:pts,time:p.finishTime});
      result.players.push({index:p.index,name:p.name,team,rank:idx+1,points:pts,time:p.finishTime});
    });

    roundHistory.push(result);
    renderTeamScore();

    if(currentRound<3){
      startBtn.textContent=`${currentRound}R 종료`;
      setTimeout(()=>{
        currentRound++;
        resetRound();
        start();
      },1200);
    }else{
      running=false;
      recordSeasonResults();
      startBtn.textContent="3R 경기 종료";
      setTimeout(showMatchResults,350);
    }
  }

  function renderTeamScore(){
    const el=document.getElementById("teamScoreBoard");
    if(!el) return;
    el.innerHTML=`<div class="team-score team-a"><b>A팀</b><span>${teamTotals.A}점</span></div>
      <div class="round-badge">${currentRound} / 3 ROUND</div>
      <div class="team-score team-b"><b>B팀</b><span>${teamTotals.B}점</span></div>`;
    renderPersonalScore();
  }

  function renderPersonalScore(){
    const el=document.getElementById("personalScoreBoard");
    if(!el) return;
    const rows=Object.values(playerTournament)
      .sort((a,b)=>b.total-a.total || a.name.localeCompare(b.name));
    el.innerHTML=`<div class="personal-score-title">개인 누적 점수</div>`+
      rows.map((pt,i)=>`<div class="personal-score-row">
        <span class="personal-rank">${i+1}</span>
        <span class="score-dot ${pt.team==="A"?"red":"blue"}"></span>
        <span class="personal-name">${pt.name}</span>
        <b>${pt.total>0?"+":""}${pt.total}</b>
      </div>`).join("");
  }

  const SIM_STEP_MS = 1000/60;
  const MAX_SIM_STEPS = 3;
  let simClock=0;
  let simAccumulator=0;

  function simulateStep(now,dt){
    updateObservers(now,dt);
    precomputeObserverPredictions();

    // Spatial lookup does not need rebuilding every visual frame. This phase is
    // staggered by simulation time, so a slow render frame cannot bunch all work.
    if((Math.floor(now/SIM_STEP_MS)%5)===0) rebuildObserverGrid();

    for(let i=0;i<players.length;i++) updatePlayer(players[i],now,dt);
    updateCamera(dt);
  }

  function loop(ts){
    if(!running) return;

    let frameDelta=ts-lastTs;
    lastTs=ts;
    if(frameDelta<0) frameDelta=0;
    if(frameDelta>50) frameDelta=50;
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
    if(simAccumulator>SIM_STEP_MS*2) simAccumulator=SIM_STEP_MS*2;

    render(ts);

    if(ts-lastRankingRender>=220){
      const rankingDt=ts-lastRankingRender;
      updateMatchRanks(rankingDt);
      updateSectors(ts);
      renderRanking();
      const raceEvent=document.getElementById("raceEvent");
      if(raceEvent && ts>=raceEventUntil) raceEvent.classList.add("hidden");
      const leadBattle=document.getElementById("leadBattle");
      if(leadBattle){
        let first=-Infinity, second=-Infinity;
        for(let i=0;i<players.length;i++){
          if(players[i].done) continue;
          const pr=currentProgress(players[i]);
          if(pr>first){ second=first; first=pr; }
          else if(pr>second) second=pr;
        }
        leadBattle.classList.toggle("hidden", !(second>-Infinity && first-second<2.0));
      }
      const unitName=currentRound===1?"SCOURGE":currentRound===2?"SCOUT":"WRAITH";
      cameraLabel.textContent=`${BUILD_ID} · ${unitName} · OBS ${observers.length} · 화면 ${lastVisibleObs} · 300%`;
      lastRankingRender=ts;
    }

    if(players.every(p=>p.done)){
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
    let sx=camX-viewW/2, sy=camY-viewH/2;
    sx=Math.max(0,Math.min(MAP_W-viewW,sx));
    sy=Math.max(0,Math.min(MAP_H-viewH,sy));
    return {sx,sy,viewW,viewH,scale};
  }

  function drawObserver(o,view){
    const x=(o.x-view.sx)*view.scale, y=(o.y-view.sy)*view.scale;
    if(x<-12||y<-12||x>canvas.width+12||y>canvas.height+12) return;
    const r=Math.max(2.142,view.scale*0.72*OBS_VISUAL_SCALE);
    ctx.fillStyle="#d6e8ff";
    ctx.strokeStyle="#5f89ad";
    ctx.lineWidth=Math.max(0.714,view.scale*.11*OBS_VISUAL_SCALE);
    ctx.beginPath();ctx.ellipse(x,y,r*1.20,r*.72,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle="#83bcdf";
    ctx.beginPath();ctx.arc(x+r*.20,y,r*.30,0,Math.PI*2);ctx.fill();
  }

  function drawPlayer(p,view,rank){
    const x=(p.x-view.sx)*view.scale, y=(p.y-view.sy)*view.scale;
    if(x<-80||y<-80||x>canvas.width+80||y>canvas.height+80) return;
    const r=Math.max(8.6846,view.scale*1.48*PLAYER_VISUAL_SCALE);

    const now=performance.now();
    const mdx=p.x-p.prevX, mdy=p.y-p.prevY;
    if(mdx*mdx+mdy*mdy>0.0004){
      const targetAngle=Math.atan2(mdy,mdx)+Math.PI/2;
      let da=targetAngle-p.visualAngle;
      while(da>Math.PI) da-=Math.PI*2;
      while(da<-Math.PI) da+=Math.PI*2;
      p.visualAngle+=da*0.18;
      p.prevX=p.x; p.prevY=p.y;
    }

    ctx.save();
    ctx.translate(x,y);

    if(now<p.hitFxUntil){
      const pulse=1-(p.hitFxUntil-now)/240;
      ctx.strokeStyle="rgba(255,235,130,.95)";
      ctx.lineWidth=Math.max(2,5*(1-pulse));
      ctx.beginPath();ctx.arc(0,0,r*(1.15+pulse*.9),0,Math.PI*2);ctx.stroke();
    }

    if(now<p.invUntil){
      ctx.globalAlpha=.48+.35*Math.abs(Math.sin(performance.now()*.018));
      ctx.strokeStyle="#fff";
      ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(0,0,r*1.45,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=1;
    }

    const sprite=unitSprites[currentRound]?.[p.team];
    if(sprite && sprite.complete && sprite.naturalWidth){
      const size=r*2.65;
      ctx.save();
      ctx.rotate(p.visualAngle);
      ctx.shadowColor=p.team==="A" ? "rgba(255,77,77,.45)" : "rgba(77,141,255,.45)";
      ctx.shadowBlur=Math.max(3,r*.28);
      ctx.drawImage(sprite,-size/2,-size/2,size,size);
      ctx.restore();
    }else{
      ctx.fillStyle=p.team==="A" ? "#ff4d4d" : "#4d8dff";
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
    ctx.strokeStyle=p.team==="A" ? "#ff4d4d" : "#4d8dff";ctx.lineWidth=1.5;
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(-tw/2,ly-lh,tw,lh,5);
    else ctx.rect(-tw/2,ly-lh,tw,lh);
    ctx.fill();ctx.stroke();
    ctx.fillStyle="#fff";ctx.textBaseline="bottom";
    ctx.fillText(label,0,ly-2);

    ctx.restore();
  }

  const renderOrder=[];

  function render(ts){
    const W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);
    if(!map.complete) return;

    const view=getView();
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(map,view.sx,view.sy,view.viewW,view.viewH,0,0,W,H);

    // World-space culling avoids transforming/drawing all 660 observers every frame.
    let visibleObs=0;
    const pad=5;
    const minX=view.sx-pad, maxX=view.sx+view.viewW+pad;
    const minY=view.sy-pad, maxY=view.sy+view.viewH+pad;
    for(const o of observers){
      if(o.x<minX||o.x>maxX||o.y<minY||o.y>maxY) continue;
      visibleObs++;
      drawObserver(o,view);
    }

    renderOrder.length=0;
    for(let i=0;i<players.length;i++) renderOrder.push(players[i]);
    renderOrder.sort((a,b)=>currentProgress(b)-currentProgress(a));
    for(let i=0;i<renderOrder.length;i++) drawPlayer(renderOrder[i],view,i+1);

    const elapsed=raceStart ? Math.max(0,(ts||performance.now())-raceStart) : 0;
    clockEl.textContent=formatTime(elapsed);
    lastVisibleObs=visibleObs;
  }

  let prevRanks=new Map();
  const SEASON_KEY="observerFM_v31_season";
  let seasonRecorded=false;

  function blankSeasonRow(){
    return {starts:0,wins:0,top3:0,finishes:0,totalRank:0,totalTime:0,bestTime:null,
      collisions:0,stops:0,avoids:0,overtakes:0,leadMs:0,distance:0};
  }

  function loadSeason(){
    try{
      const data=JSON.parse(localStorage.getItem(SEASON_KEY)||"{}");
      for(const n of names) if(!data[n]) data[n]=blankSeasonRow();
      return data;
    }catch(e){
      const data={}; for(const n of names) data[n]=blankSeasonRow(); return data;
    }
  }

  function saveSeason(data){
    try{ localStorage.setItem(SEASON_KEY,JSON.stringify(data)); }catch(e){}
  }

  function recordSeasonResults(){
    if(seasonRecorded || !players.length || !players.every(p=>p.done)) return;
    const season=loadSeason();
    const ordered=[...players].sort((a,b)=>a.finishTime-b.finishTime);
    ordered.forEach((p,idx)=>{
      const s=season[p.name]||blankSeasonRow();
      const rank=idx+1;
      s.starts++; s.totalRank+=rank; s.finishes++;
      if(rank===1) s.wins++;
      if(rank<=3) s.top3++;
      s.totalTime+=p.finishTime||0;
      s.bestTime=s.bestTime==null ? p.finishTime : Math.min(s.bestTime,p.finishTime);
      s.collisions+=p.match.collisions;
      s.stops+=p.match.stops;
      s.avoids+=p.match.avoids;
      s.overtakes+=p.match.overtakes;
      s.leadMs+=p.match.leadMs;
      s.distance+=p.match.distance;
      season[p.name]=s;
    });
    saveSeason(season);
    seasonRecorded=true;
  }

  function resetSeason(){
    if(!confirm("v31 시즌 누적 기록을 전부 초기화할까요?")) return;
    localStorage.removeItem(SEASON_KEY);
    alert("시즌 기록을 초기화했습니다.");
  }

  function pushRaceEvent(text,now=performance.now()){
    raceEventText=text;
    raceEventUntil=now+1600;
    const el=document.getElementById("raceEvent");
    if(el){ el.textContent=text; el.classList.remove("hidden"); }
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
          pushRaceEvent(`BEST SECTOR ${si+1} · ${p.name} ${formatTime(sectorMs)}`,now);
        }
      }
    }
  }

  function updateMatchRanks(dt){
    const ordered=[...players].sort((a,b)=>currentProgress(b)-currentProgress(a));
    ordered.forEach((p,idx)=>{
      const rank=idx+1;
      p.match.bestRank=Math.min(p.match.bestRank,rank);
      p.match.worstRank=Math.max(p.match.worstRank,rank);
      p.match.maxRankGain=Math.max(p.match.maxRankGain,p.match.startRank-rank);
      p.match.maxRankLoss=Math.max(p.match.maxRankLoss,rank-p.match.startRank);
      const prev=prevRanks.get(p.index);
      if(prev!=null && rank<prev){
        p.match.overtakes += (prev-rank);
        if(prev-rank>=1) pushRaceEvent(`${p.name} · ${prev}위 → ${rank}위`);
      }
      prevRanks.set(p.index,rank);
    });
    if(ordered[0] && !ordered[0].done){
      ordered[0].match.leadMs += dt;
      if(lastLeaderName && lastLeaderName!==ordered[0].name){
        pushRaceEvent(`NEW LEADER · ${ordered[0].name}`);
      }
      lastLeaderName=ordered[0].name;
    }
  }

  function renderRanking(){
    const ordered=[...players].sort((a,b)=>{
      if(a.done && b.done) return a.finishTime-b.finishTime;
      if(a.done) return -1;if(b.done) return 1;
      const diff=currentProgress(b)-currentProgress(a);
      if(Math.abs(diff)<0.20) return a.index-b.index;
      return diff;
    });
    rankingEl.innerHTML="";
    const leaderProg=currentProgress(ordered[0]);
    ordered.forEach((p,i)=>{
      const row=document.createElement("div");
      row.className="rank-row";
      let gap;
      if(p.done) gap=formatTime(p.finishTime);
      else if(i===0) gap="LEADER";
      else {
        const distGap=Math.max(0,leaderProg-currentProgress(p));
        const leaderSpeed=Math.max(1.0,ordered[0].speed||1);
        gap=`+${(distGap/leaderSpeed).toFixed(2)}s`;
      }
      row.innerHTML=`<span class="rank-no">${i+1}</span><span class="team-mini team-${p.team.toLowerCase()}">${p.team}</span><button class="rank-name player-link" data-player="${p.index}">${p.name}</button><span class="rank-gap">${gap}</span>`;
      row.querySelector(".player-link").addEventListener("click",()=>openPlayerCard(p));
      rankingEl.appendChild(row);
    });
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

  function overallOf(p){
    const vals=Object.values(p.stats);
    return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
  }

  function seasonCardHtml(p){
    const s=loadSeason()[p.name]||blankSeasonRow();
    if(!s.starts) return `<div class="seasonBox"><h3>시즌 기록</h3><p>아직 누적 경기 기록이 없습니다.</p></div>`;
    const avgRank=s.totalRank/s.starts;
    const finishRate=s.finishes/s.starts*100;
    const avgTime=s.finishes ? s.totalTime/s.finishes : 0;
    const avgCollision=s.collisions/s.starts;
    return `<div class="seasonBox">
      <h3>시즌 누적 기록</h3>
      <div class="seasonGrid">
        <div><span>출전</span><b>${s.starts}</b></div>
        <div><span>우승</span><b>${s.wins}</b></div>
        <div><span>TOP3</span><b>${s.top3}</b></div>
        <div><span>평균 순위</span><b>${avgRank.toFixed(2)}</b></div>
        <div><span>완주율</span><b>${finishRate.toFixed(1)}%</b></div>
        <div><span>평균 기록</span><b>${formatTime(avgTime)}</b></div>
        <div><span>최고 기록</span><b>${s.bestTime?formatTime(s.bestTime):"-"}</b></div>
        <div><span>경기당 충돌</span><b>${avgCollision.toFixed(2)}</b></div>
        <div><span>총 추월</span><b>${s.overtakes}</b></div>
        <div><span>선두 시간</span><b>${(s.leadMs/1000).toFixed(1)}s</b></div>
      </div>
    </div>`;
  }

  function openPlayerCard(p){
    const modal=document.getElementById("playerModal");
    const title=document.getElementById("playerModalTitle");
    const body=document.getElementById("playerModalBody");
    const entries=Object.entries(p.stats).sort((a,b)=>b[1]-a[1]);
    title.textContent=`${p.name} · OVR ${overallOf(p)} · ${styleLabel(p.drivingStyle.style)}`;
    body.innerHTML=`
      <div class="profileSummary">
        <div><b>소속팀</b><span>${teamLabel(p.team)}</span></div>
        <div><b>주행 성향</b><span>${styleLabel(p.drivingStyle.style)}</span></div>
        <div><b>팀전 누적점수</b><span>${playerTournament[p.index]?.total||0}점</span></div>
        <div><b>강점</b><span>${entries.slice(0,3).map(([k,v])=>`${statLabel(k)} ${v}`).join(" · ")}</span></div>
        <div><b>약점</b><span>${entries.slice(-3).reverse().map(([k,v])=>`${statLabel(k)} ${v}`).join(" · ")}</span></div>
      </div>
      <div class="statGrid">${Object.entries(p.stats).map(([k,v])=>`<div class="statCell"><span>${statLabel(k)}</span><b>${v}</b></div>`).join("")}</div>
      ${seasonCardHtml(p)}`;
    modal.classList.remove("hidden");
  }

  function showMatchResults(){
    const panel=document.getElementById("resultPanel");
    const body=document.getElementById("resultBody");
    const teamSummary=document.getElementById("teamResultSummary");

    const winner=teamTotals.A===teamTotals.B ? "무승부" : (teamTotals.A>teamTotals.B ? "A팀 승리" : "B팀 승리");
    teamSummary.innerHTML=`<div class="winner">${winner}</div>
      <div class="final-team-score"><span>A팀 <b>${teamTotals.A}</b></span><span>B팀 <b>${teamTotals.B}</b></span></div>
      <div class="round-score-list">${roundHistory.map(r=>`<span>${r.round}R · A ${r.team.A} : ${r.team.B} B</span>`).join("")}</div>`;

    const rows=Object.values(playerTournament).sort((a,b)=>b.total-a.total || a.name.localeCompare(b.name));
    body.innerHTML=rows.map((pt,i)=>{
      const r=[1,2,3].map(n=>{
        const x=pt.rounds.find(v=>v.round===n);
        return x ? `${x.rank}위 / ${x.points>0?"+":""}${x.points}` : "-";
      });
      return `<tr>
        <td>${i+1}</td>
        <td><span class="team-mini team-${pt.team.toLowerCase()}">${pt.team}</span></td>
        <td><button class="result-name player-link" data-player="${names.indexOf(pt.name)}">${pt.name}</button></td>
        <td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td>
        <td><b>${pt.total>0?"+":""}${pt.total}</b></td>
      </tr>`;
    }).join("");
    body.querySelectorAll(".result-name").forEach(el=>{
      el.addEventListener("click",()=>openPlayerCard(players[Number(el.dataset.player)]));
    });
    panel.classList.remove("hidden");
  }

  function formatTime(ms){
    const total=Math.max(0,ms)/1000;
    const m=Math.floor(total/60);
    const s=total-m*60;
    return `${String(m).padStart(2,"0")}:${s.toFixed(1).padStart(4,"0")}`;
  }

  startBtn.addEventListener("click",start);
  restartBtn.addEventListener("click",()=>{ reset(); start(); });
  document.getElementById("resultBtn").addEventListener("click",showMatchResults);
  document.getElementById("seasonResetBtn").addEventListener("click",resetSeason);
  document.getElementById("resultClose").addEventListener("click",()=>document.getElementById("resultPanel").classList.add("hidden"));
  document.getElementById("playerModalClose").addEventListener("click",()=>document.getElementById("playerModal").classList.add("hidden"));
  document.getElementById("playerModal").addEventListener("click",e=>{
    if(e.target.id==="playerModal") e.currentTarget.classList.add("hidden");
  });

  map.addEventListener("load",reset);
  if(map.complete) reset();
})();
