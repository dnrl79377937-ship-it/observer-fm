
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
  const OBSERVER_COUNT = 600;
  const HIT_CHANCE = 1.00;
  const STUN_MS = 2000;
  const INV_MS = 1000;
  const CAMERA_ZOOM = 3.0;
  const BUILD_ID = "v21";

  // Engine safeguards. Visual sprite size is independent of collision radius.
  const PLAYER_HIT_RADIUS = 0.44;     // unchanged collision feel
  const PLAYER_VISUAL_SCALE = 0.815203125;   // v14 visual size
  const OBS_VISUAL_SCALE = 0.51;      // v14 visual size
  const OBS_SPEED_RATIO = 0.90;         // observer speed ≈ 90% of player speed
  const OBS_WANDER_RANGE = 0.88;        // legacy value (not used for full-map roam)
  const OBS_MOVE_MS = 10000;            // move for 10 seconds
  const OBS_STOP_MS = 1000;             // then stop for 1 second
  const AVOID_SCAN_RADIUS = 34.0;        // look ahead for nearby observers
  const AVOID_CRITICAL_RADIUS = 9.0;     // emergency reaction zone
  const AVOID_PREDICT_SEC = 2.90;        // predict observer positions ahead
  const AVOID_REACTION_CHANCE = 0.9995;  // much stronger reaction rate
  const AVOID_SAFE_BUFFER = 5.8;
  const AVOID_LANE_LOOKAHEAD = 2.60;   // compare future lane safety
  const INSIDE_CORNER_STRENGTH = 0.998; // Kart-style inside apex bias
        // extra body-size safety margin
  const ROAD_MARGIN = 0.90;           // keep units inside the drivable corridor
  const STUCK_RESCUE_MS = 2200;       // recover from pathological steering states

  const names = ["Angel","Egle","GhostRider","Bacilius","Zino","Chotbul","Kaka","Pika"];
  const colors = ["#66e3ff","#ffdb66","#ff7a8a","#9b8cff","#72f0a7","#ff9f5c","#f275ff","#b6f06e"];

  // Hidden FM-style driving profiles.
  // These shape line precision, pace and evasive-control behavior,
  // raw pace and how often/skillfully each player uses special controls.
  const profiles = [
    { pace:96, line:95, control:91, aggression:82 }, // Angel
    { pace:93, line:92, control:95, aggression:68 }, // Egle
    { pace:97, line:88, control:94, aggression:91 }, // GhostRider
    { pace:91, line:96, control:86, aggression:62 }, // Bacilius
    { pace:95, line:91, control:90, aggression:78 }, // Zino
    { pace:90, line:89, control:96, aggression:73 }, // Chotbul
    { pace:94, line:94, control:87, aggression:70 }, // Kaka
    { pace:92, line:90, control:92, aggression:84 }  // Pika
  ];

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
      const paceNorm=(pf.pace-90)/10;
      return {
        index:i,name,color:colors[i],profile:pf,
        x:20.5, y:154.8 + (i-3.5)*0.48,
        seg:0,
        // Pace creates small but meaningful differences, not runaway gaps.
        speed: (9.50 + paceNorm*0.42 + Math.random()*0.08) * 1.2075,
        desiredOffset:(i-3.5)*0.48,
        stunUntil:0, invUntil:0, collisionLockUntil:0,
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
        resumeEaseUntil:0
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

  function reset(){
    cancelAnimationFrame(raf);
    players=makePlayers();
    observers=spawnObservers();
    running=false;
    raceStart=0; lastTs=0;
    camX=28; camY=158;
    startBtn.textContent="LIVE 시작";
    render(0);
    renderRanking();
  }

  function currentProgress(p){
    if(p.done) return routeLength+1000-(p.finishTime||0)/1000000;
    const s=segs[Math.min(p.seg,segs.length-1)];
    const along=((p.x-s.a[0])*s.ux+(p.y-s.a[1])*s.uy);
    return s.start + Math.max(0,Math.min(s.L,along));
  }

  function start(){
    if(running) return;
    if(players.every(p=>p.done)) reset();
    running=true;
    const now=performance.now();
    if(!raceStart) raceStart=now;
    lastTs=now;
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


  const OBS_GRID_SIZE = 20;
  let observerGrid = new Map();

  function rebuildObserverGrid(){
    observerGrid.clear();
    for(const o of observers){
      const gx=Math.floor(o.x/OBS_GRID_SIZE);
      const gy=Math.floor(o.y/OBS_GRID_SIZE);
      const key=gx+","+gy;
      let bucket=observerGrid.get(key);
      if(!bucket){ bucket=[]; observerGrid.set(key,bucket); }
      bucket.push(o);
    }
  }

  const nearbyBufferPool = Array.from({length:8},()=>[]);
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
        const bucket=observerGrid.get(gx+","+gy);
        if(!bucket) continue;
        for(let i=0;i<bucket.length;i++) out.push(bucket[i]);
      }
    }
    return out;
  }

  function observerVelocity(o){
    return o.phase==="move" ? [o.vx||0,o.vy||0] : [0,0];
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
    // Start (7 o'clock) -> lower-right (5 o'clock):
    // stay higher/inside earlier so the vertical climb begins from a shorter line.
    if(si>=0 && si<=3) return -0.36;
    if(si>=4 && si<=6) return -0.54;
    if(si>=7 && si<=9) return -0.62;
    if(si>=10 && si<=11) return -0.38;
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

  function chooseAvoidance(p,s,now){
    if(safeAt(p.x,p.y)) return null;

    let threat=null;
    let threatScore=Infinity;
    let immediate=false;
    let leftDanger=0, rightDanger=0;
    let nearestFuture=Infinity;

    const pxFuture=p.x+s.ux*p.speed*AVOID_PREDICT_SEC;
    const pyFuture=p.y+s.uy*p.speed*AVOID_PREDICT_SEC;

    for(const o of nearbyObservers(p.x,p.y,AVOID_SCAN_RADIUS)){
      const dx=o.x-p.x, dy=o.y-p.y;
      const dist=Math.hypot(dx,dy);
      if(dist>AVOID_SCAN_RADIUS) continue;

      const [ovx,ovy]=observerVelocity(o);
      const fx=o.x+ovx*AVOID_PREDICT_SEC;
      const fy=o.y+ovy*AVOID_PREDICT_SEC;
      const futureDist=Math.hypot(fx-pxFuture,fy-pyFuture);
      nearestFuture=Math.min(nearestFuture,futureDist);

      // Larger player body: reserve more room around observer traffic.
      const side=dx*s.nx+dy*s.ny;
      const danger=Math.max(0,AVOID_SCAN_RADIUS-dist) +
                   Math.max(0,AVOID_SCAN_RADIUS-futureDist)*1.45;
      if(side>=0) rightDanger+=danger;
      else leftDanger+=danger;

      const score=dist*0.48+futureDist*1.32;
      if(score<threatScore){
        threatScore=score;
        threat=o;
        immediate=dist<(AVOID_CRITICAL_RADIUS+AVOID_SAFE_BUFFER) ||
                  futureDist<(AVOID_CRITICAL_RADIUS+AVOID_SAFE_BUFFER);
      }
    }

    if(!threat || threatScore>24.0){
      p.avoidThreatId=-1;
      return null;
    }

    // New threat => almost always react. This is intentionally higher than v14
    // because the visible player body is now 25% larger.
    if(p.avoidThreatId!==threat.id){
      p.avoidThreatId=threat.id;
      p.avoidWillDodge=Math.random()<AVOID_REACTION_CHANCE;
    }
    if(!p.avoidWillDodge && !immediate && nearestFuture>8.5) return null;

    // Prefer the less crowded side and make a stronger move before contact.
    const openSide = leftDanger<=rightDanger ? -1 : 1;
    const r=Math.random();

    if(immediate || nearestFuture<6.5){
      if(r<0.10) return {mode:"stop",side:openSide,strength:1.0};
      if(r<0.76) return {mode:"diagonal",side:openSide,strength:1.18};
      return {mode:"zigzag",side:openSide,strength:1.08};
    }

    if(r<0.07) return {mode:"stop",side:openSide,strength:0.92};
    if(r<0.73) return {mode:"diagonal",side:openSide,strength:1.08};
    if(r<0.94) return {mode:"zigzag",side:openSide,strength:1.00};
    return {mode:"wide",side:openSide,strength:0.98};
  }

  function updatePlayer(p, now, dt){
    if(p.done) return;

    if(now < p.stunUntil) return;
    if(p.stunUntil){
      p.stunUntil=0;
      p.invUntil=now+INV_MS;
    }

    chooseControl(p,now,dt);

    const si=Math.min(p.seg,segs.length-1);
    const s=segs[si];
    const half=widths[si]*0.72;
    let targetOff=optimalOffsetFor(p);
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

      const openBias=openingInsideBias(si);
      if(openBias!==0){
        const openingHalf=Math.max(1.6,widths[si]*0.56);
        const openingTarget=openBias*openingHalf;
        targetOff=targetOff*0.30+openingTarget*0.70;
      }

    // Lower line skill adds slightly more steering error, while everyone still
    // follows the optimized racing line most of the time.
    const lineError=(100-p.profile.line)/100;
    targetOff += Math.sin((now/1000)*0.7+p.index*1.3)*half*(0.018+lineError*0.16);

    let speedMul=1;
    const controlSkill=(p.profile.control-85)/15;

    // Reactive AI: scan moving observers and use an evasive move before contact.
    const avoid=chooseAvoidance(p,s,now);
    if(avoid){
      const evadeHalf=Math.max(4.2,widths[si]*1.02);
      if(avoid.mode==="stop"){
        speedMul=0;
      }else if(avoid.mode==="diagonal"){
        targetOff += avoid.side*evadeHalf*1.34*avoid.strength;
        speedMul=1.01;
      }else if(avoid.mode==="zigzag"){
        targetOff += avoid.side*evadeHalf*1.18 +
          Math.sin(now*0.031+p.index)*evadeHalf*0.38;
        speedMul=0.96;
      }else if(avoid.mode==="wide"){
        targetOff += avoid.side*evadeHalf*1.30;
        speedMul=0.94;
      }
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
    p.desiredOffset += (targetOff-p.desiredOffset)*Math.min(0.16,dt*0.0048);

    // Look ahead to create smoother apex cutting.
    const next=segs[Math.min(segs.length-1,si+1)];
    let tx=s.b[0]+s.nx*p.desiredOffset;
    let ty=s.b[1]+s.ny*p.desiredOffset;
    if(next && si<segs.length-1){
      const look=0.24;
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

    // Robust segment advancement: crossing the end plane OR entering the next joint zone.
    // A short while-loop handles high FPS drops without skipping/sticking.
    let advances=0;
    while(p.seg<segs.length-1 && advances<3){
      const cs=segs[p.seg];
      const rx=p.x-cs.a[0], ry=p.y-cs.a[1];
      const alongPx=rx*cs.ux+ry*cs.uy;
      const nearEnd=Math.hypot(p.x-cs.b[0],p.y-cs.b[1])<3.4;
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
    if(p.seg>=segs.length-1 && (finishAlong>=fs.L*0.88 || Math.hypot(p.x-last[0],p.y-last[1])<6.2)){
      p.done=true;
      p.finishTime=now-raceStart;
      return;
    }

    rescueIfStuck(p,now);

    // Collision check: actual contact = guaranteed stop outside invincible safe zones.
    if(!safeAt(p.x,p.y) && now>=p.invUntil && now>=p.collisionLockUntil){
      for(const o of nearbyObservers(p.x,p.y,PLAYER_HIT_RADIUS+1.0)){
        if(Math.abs(o.x-p.x)>PLAYER_HIT_RADIUS || Math.abs(o.y-p.y)>PLAYER_HIT_RADIUS) continue;
        if(Math.hypot(p.x-o.x,p.y-o.y)<PLAYER_HIT_RADIUS){
          p.hits++;
          p.stunUntil=now+STUN_MS;
          p.collisionLockUntil=now+STUN_MS+INV_MS;
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

  function updateCamera(dt){
    const active=players.filter(p=>!p.done).sort((a,b)=>currentProgress(b)-currentProgress(a));
    if(!active.length) return;

    const now=performance.now();
    const top=active[0];
    let leader=top;
    const held=active.find(p=>p.index===cameraLeaderId);

    if(held && now<cameraLeaderHoldUntil){
      const gap=currentProgress(top)-currentProgress(held);
      if(gap<5.0) leader=held;
    }
    if(!held || leader===top && top.index!==cameraLeaderId){
      cameraLeaderId=leader.index;
      cameraLeaderHoldUntil=now+650;
    }

    let tx=leader.x,ty=leader.y;
    const second=active.find(p=>p!==leader);
    if(second && Math.abs(currentProgress(leader)-currentProgress(second))<2.5){
      tx=leader.x*.88+second.x*.12;
      ty=leader.y*.88+second.y*.12;
    }
    const a=Math.min(0.12,dt*0.0036);
    camX+=(tx-camX)*a; camY+=(ty-camY)*a;
  }

  function loop(ts){
    if(!running) return;
    // Clamp dt so background-tab stalls never make the simulation explode.
    const dt=Math.min(20,Math.max(0,ts-lastTs));
    lastTs=ts;

    updateObservers(ts,dt);
    rebuildObserverGrid();
    for(const p of players) updatePlayer(p,ts,dt);
    updateCamera(dt);
    render(ts);
    renderRanking();

    if(players.every(p=>p.done)){
      running=false;
      startBtn.textContent="경기 종료";
      return;
    }
    raf=requestAnimationFrame(loop);
  }

  function worldToScreen(x,y,view){
    return [(x-view.sx)*view.scale,(y-view.sy)*view.scale];
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
    const [x,y]=worldToScreen(o.x,o.y,view);
    if(x<-12||y<-12||x>canvas.width+12||y>canvas.height+12) return;
    const r=Math.max(2.142,view.scale*0.72*OBS_VISUAL_SCALE);
    ctx.save();
    ctx.translate(x,y);
    ctx.fillStyle="#d6e8ff";
    ctx.strokeStyle="#5f89ad";
    ctx.lineWidth=Math.max(0.714,view.scale*.11*OBS_VISUAL_SCALE);
    ctx.beginPath();ctx.ellipse(0,0,r*1.20,r*.72,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle="#83bcdf";
    ctx.beginPath();ctx.arc(r*.20,0,r*.30,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }

  function drawPlayer(p,view,rank){
    const [x,y]=worldToScreen(p.x,p.y,view);
    if(x<-80||y<-80||x>canvas.width+80||y>canvas.height+80) return;
    const r=Math.max(10.2172,view.scale*1.48*PLAYER_VISUAL_SCALE);

    ctx.save();
    ctx.translate(x,y);

    if(performance.now()<p.invUntil){
      ctx.globalAlpha=.48+.35*Math.abs(Math.sin(performance.now()*.018));
      ctx.strokeStyle="#fff";
      ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(0,0,r*1.45,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=1;
    }

    ctx.fillStyle=p.color;
    ctx.strokeStyle="#07111a";
    ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();

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
    ctx.strokeStyle=p.color;ctx.lineWidth=1.5;
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(-tw/2,ly-lh,tw,lh,5);
    else ctx.rect(-tw/2,ly-lh,tw,lh);
    ctx.fill();ctx.stroke();
    ctx.fillStyle="#fff";ctx.textBaseline="bottom";
    ctx.fillText(label,0,ly-2);

    ctx.restore();
  }

  function render(ts){
    const W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);
    if(!map.complete) return;

    const view=getView();
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(map,view.sx,view.sy,view.viewW,view.viewH,0,0,W,H);

    // Draw every observer that falls inside this 300% camera crop.
    for(const o of observers) drawObserver(o,view);

    const ordered=[...players].sort((a,b)=>currentProgress(b)-currentProgress(a));
    ordered.forEach((p,i)=>drawPlayer(p,view,i+1));

    const elapsed=raceStart ? Math.max(0,(ts||performance.now())-raceStart) : 0;
    clockEl.textContent=formatTime(elapsed);
    let visibleObs=0;
    for(const o of observers){
      const [ox,oy]=worldToScreen(o.x,o.y,view);
      if(ox>=0 && oy>=0 && ox<=canvas.width && oy<=canvas.height) visibleObs++;
    }
    cameraLabel.textContent=`${BUILD_ID} · OBS ${observers.length} · 화면 ${visibleObs} · 300%`;
  }

  function renderRanking(){
    const ordered=[...players].sort((a,b)=>{
      if(a.done && b.done) return a.finishTime-b.finishTime;
      if(a.done) return -1;if(b.done) return 1;
      return currentProgress(b)-currentProgress(a);
    });
    rankingEl.innerHTML="";
    const leaderProg=currentProgress(ordered[0]);
    ordered.forEach((p,i)=>{
      const row=document.createElement("div");
      row.className="rank-row";
      let gap;
      if(p.done) gap=formatTime(p.finishTime);
      else if(i===0) gap="LEADER";
      else gap=`-${Math.max(0,leaderProg-currentProgress(p)).toFixed(1)}m`;
      row.innerHTML=`<span class="rank-no">${i+1}</span><span class="rank-name">${p.name}</span><span class="rank-gap">${gap}</span>`;
      rankingEl.appendChild(row);
    });
  }

  function formatTime(ms){
    const total=Math.max(0,ms)/1000;
    const m=Math.floor(total/60);
    const s=total-m*60;
    return `${String(m).padStart(2,"0")}:${s.toFixed(1).padStart(4,"0")}`;
  }

  startBtn.addEventListener("click",start);
  restartBtn.addEventListener("click",()=>{ reset(); start(); });

  map.addEventListener("load",reset);
  if(map.complete) reset();
})();
