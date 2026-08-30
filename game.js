
(() => {
  "use strict";

  const canvas = document.getElementById("race");
  const ctx = canvas.getContext("2d");
  const rankingEl = document.getElementById("rankingList");
  const focusModeBtn = document.getElementById("focusModeBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const layoutEl = document.querySelector(".layout");
  const broadcastEl = document.querySelector(".broadcast");

  const diagToggle=document.getElementById("diagToggle");
  const diagnostics=document.getElementById("diagnostics");
  const clockEl = document.getElementById("clock");
  const cameraLabel = document.getElementById("cameraLabel");
  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");

  const MAP_W = 257, MAP_H = 178;
  const OBSERVER_COUNT = 650;
  const HIT_CHANCE = 1.00;
  const STUN_MS = 2300;
  const INV_MS = 1000;
  const CAMERA_ZOOM = 3.0;
  const BUILD_ID = "v2.51";
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
  const PLAYER_HIT_RADIUS = 0.30;     // unchanged collision feel
  const PLAYER_VISUAL_SCALE = 0.5889842578125;   // v14 visual size
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

  // v2.21: stronger behavioral identity; never changes raw base speed.
  const drivingIdentity={
    apexHunter:{apex:1.13,safety:.94,pass:1.08,patience:.90,control:"zigzag"},
    safeReader:{apex:.96,safety:1.13,pass:.92,patience:1.14,control:"wide"},
    attacker:{apex:1.06,safety:.91,pass:1.15,patience:.86,control:"backcon"},
    lineMaster:{apex:1.12,safety:1.02,pass:1.04,patience:1.03,control:"zigzag"},
    balanced:{apex:1,safety:1,pass:1,patience:1,control:"zigzag"},
    controller:{apex:.98,safety:1.10,pass:.94,patience:1.10,control:"stopcon"},
    patient:{apex:.97,safety:1.08,pass:.96,patience:1.16,control:"wide"},
    opportunist:{apex:1.08,safety:.96,pass:1.10,patience:.94,control:"backcon"}
  };
  function identityOf(p){return drivingIdentity[p.drivingStyle?.style]||drivingIdentity.balanced;}
  const signatureMoves={apexHunter:{label:"WALL APEX",inside:1.24,skim:1.18},safeReader:{label:"SAFE ARC",inside:.82,skim:1.04},attacker:{label:"THREAD ATTACK",inside:1.08,skim:1.30},lineMaster:{label:"PERFECT LINE",inside:1.30,skim:1.14},balanced:{label:"ADAPTIVE",inside:1,skim:1},controller:{label:"CONTROL CUT",inside:.90,skim:1.06},patient:{label:"WAIT & CUT",inside:.92,skim:1.08},opportunist:{label:"GAP HUNTER",inside:1.16,skim:1.26}};
  function signatureOf(p){return signatureMoves[p.drivingStyle?.style]||signatureMoves.balanced;}


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

  // v2.43: hidden special-inside permissions based on the user's guide.
  // No yellow guide or special line is ever rendered in-game or in stats.
  const SPECIAL_INSIDE_SEGMENTS=new Set([
    0,1,2,3,4,5,6,7,8,
    11,12,13,14,15,16,17,18,
    20,21,22,23,24,25,
    27,28,29,30,31,32
  ]);

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
  let paused = false;
  let pauseStarted = 0;
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
  let tournamentHighlights=[];
  let roundTransitioning=false;
  let lastMasterResult=null;

  function clonePlain(v){ return JSON.parse(JSON.stringify(v)); }

  function engineCoreRules(){
    return {build:BUILD_ID,observerCount:OBSERVER_COUNT,playerCount:8,
      playerHitRadius:PLAYER_HIT_RADIUS,stunMs:STUN_MS,invMs:INV_MS,
      cameraZoom:CAMERA_ZOOM,simHz:Math.round(1000/SIM_STEP_MS),
      playerCollision:false,safeZoneInvulnerability:true,
      baseSpeedMultiplier:1.464395625};
  }

  function buildMasterMatchResult(){
    const ratings=aggregateMatchRatings();
    const ratingByIndex=new Map(ratings.map(x=>[x.index,x]));
    const winnerTeam=teamTotals.A===teamTotals.B?null:(teamTotals.A>teamTotals.B?"A":"B");
    const playerResults=names.map((name,index)=>{
      const pt=playerTournament[index]||{rounds:[],total:0,team:teamAssignments[index]||"A"};
      const rows=roundHistory.flatMap(r=>(r.players||[]).filter(x=>x.index===index));
      const mr=ratingByIndex.get(index);
      return {index,name,team:pt.team,totalPoints:pt.total||0,
        matchRating:mr?.rating??null,grade:mr?ratingGrade(mr.rating):null,
        rounds:(pt.rounds||[]).map(rr=>{
          const x=rows.find(v=>v.time===rr.time)||rows.find(v=>v.rating===rr.rating)||null;
          return {round:rr.round,rank:rr.rank,points:rr.points,timeMs:rr.time,rating:rr.rating,
            collisions:x?.collisions??0,overtakes:x?.overtakes??0,avoids:x?.avoids??0,
            leadMs:x?.leadMs??0,controlAttempts:x?.controlAttempts??0,
            controlSuccesses:x?.controlSuccesses??0,efficiency:x?.efficiency??0,
            raceForm:x?.raceForm??null,startReactionMs:x?.startReactionMs??null,
            startExecution:x?.startExecution??null,bestSector:x?.bestSector??null};
        })};
    });
    return {schema:"observer-fm-race-result@1",build:BUILD_ID,createdAt:new Date().toISOString(),
      rules:engineCoreRules(),match:{rounds:roundHistory.length,
        teamScores:{A:teamTotals.A,B:teamTotals.B},winnerTeam,margin:Math.abs(teamTotals.A-teamTotals.B)},
      players:playerResults,
      rounds:roundHistory.map(r=>({round:r.round,team:{A:r.team.A,B:r.team.B},
        leaderChanges:r.leaderChanges||0,totalOvertakes:r.totalOvertakes||0,
        photoFinish:photoFinishArchive[r.round]?clonePlain(photoFinishArchive[r.round]):null,
        players:(r.players||[]).map(x=>({index:x.index,name:x.name,team:x.team,rank:x.rank,
          points:x.points,timeMs:x.time,rating:x.rating,collisions:x.collisions,
          overtakes:x.overtakes,avoids:x.avoids,leadMs:x.leadMs,
          controlAttempts:x.controlAttempts,controlSuccesses:x.controlSuccesses,
          controlByType:clonePlain(x.controlByType||{}),passPlans:clonePlain(x.passPlans||{}),
          insideRate:x.insideRate,extremeInsideRate:x.extremeInsideRate,efficiency:x.efficiency,
          rankGain:x.rankGain,bestSector:x.bestSector,raceForm:x.raceForm,
          startReactionMs:x.startReactionMs,startExecution:x.startExecution}))})),
      highlights:clonePlain(tournamentHighlights),analysis:buildMatchAnalysisReport()};
  }

  function publishMasterResult(){
    lastMasterResult=buildMasterMatchResult();
    window.__OBSERVER_FM_LAST_RESULT__=clonePlain(lastMasterResult);
    window.dispatchEvent(new CustomEvent("observerfm:matchcomplete",{detail:clonePlain(lastMasterResult)}));
    return lastMasterResult;
  }


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
    tournamentHighlights=[];
    lastMasterResult=null;
    window.__OBSERVER_FM_LAST_RESULT__=null;
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
      const consistency=(stats.consistency-72)/27;
      const luck=(stats.luck-72)/27;
      const formSpread=.055-consistency*.022;
      const formRoll=(Math.random()+Math.random()+Math.random()-1.5)/1.5;
      const raceForm=Math.max(.955,Math.min(1.045,1+formRoll*formSpread+(luck-.5)*.006));
      return {
        index:i,name,color:colors[i],profile:pf,stats,drivingStyle,team:teamAssignments[i]||"A",
        raceForm,
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
        creativeRouteBudget:.38, creativeRouteUsed:0, creativeMode:0,
        creativeModeUntil:0, creativeCooldown:900+Math.random()*1200,
        creativeSide:Math.random()<.5?-1:1, creativePhase:Math.random()*Math.PI*2,
        routeIdentityBias:Math.max(-.78,Math.min(.78,(Math.random()*1.20-.60)+(drivingStyle.attack-drivingStyle.safety)*.42)),
        routeIdentityPhase:Math.random()*Math.PI*2,
        skimDodgeCooldown:0,
        liveRatingHistory:[],lastRatingSampleAt:0,
        x:20.5, y:154.8 + (i-3.5)*0.48,
        steerX:1, steerY:0,
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
        ) * 1.464395625,
        desiredOffset:(i-3.5)*0.48,
        stunUntil:0, invUntil:0, collisionLockUntil:0,
        hitFxUntil:0, hitGrayUntil:0, visualAngle:0, prevX:route[0][0], prevY:route[0][1],
        sectorIndex:0, sectorStartMs:0, sectorTimes:[],
        humanMode:0, humanModeUntil:0, humanPhase:Math.random()*Math.PI*2,
        decisionErrorUntil:0, textWidth:0,
        hits:0, done:false, finishTime:null,
        controlMode:"normal", controlUntil:0,
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
        lastX:20.5,
        lastY:154.8 + (i-3.5)*0.48,
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
        avoidExitSide:0,
        avoidExitUntil:0,
        avoidClearSince:0,
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
        clutchDecisionUntil:0,
        clutchLineOffset:0,
        clutchSpeedMul:1,
        resumeEaseUntil:0,
        match:{
          collisions:0,stops:0,avoids:0,overtakes:0,leadMs:0,
          nearMisses:0,extremeNearMisses:0,lastNearMissAt:0,dangerExposureMs:0,
          controlAttempts:0,controlSuccesses:0,
          controlByType:{
            zigzag:{attempts:0,successes:0},
            backcon:{attempts:0,successes:0},
            stopcon:{attempts:0,successes:0},
            wide:{attempts:0,successes:0}
          },
          passPlans:{inside:0,outside:0,waitCut:0},
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
        rx:24+Math.random()*24,
        ry:18+Math.random()*22,
        strength:.30+Math.random()*.22
      });
    }
    return zones;
  }
  function densitySpawnPoint(){
    // Most observers remain globally random. A bounded share is biased into
    // 2–3 random zones each round, so the dangerous area changes without
    // turning observers into course-followers.
    if(observerDensityZones.length && Math.random()<.43){
      const z=observerDensityZones[Math.floor(Math.random()*observerDensityZones.length)];
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
        cycleOffset:Math.random()*(OBS_MOVE_MS+OBS_STOP_MS)
      };
      pickObserverLeg(o);
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
    observers=spawnObservers();
    running=false;
    raceStart=0; lastTs=0; lastRankingRender=0; simClock=0; simAccumulator=0; simTickCounter=0;
    lastLeaderName=""; raceEventText=""; raceEventUntil=0; bestSector=[null,null,null];
    broadcastFocusId=-1; broadcastFocusUntil=0; previousUiRanks=new Map();
    diagFrames=0; diagFps=0; diagLastFpsTs=0; diagFrameMs=0; diagMaxFrameMs=0; raceLeaderChanges=0; raceTotalOvertakes=0; lastCloseBattleKey=""; lastCloseBattleEventAt=0;
    seasonRecorded=false; prevRanks=new Map();
    camX=28; camY=158;
    roundTransitioning=false;
    startBtn.textContent=`${currentRound}R 시작`;
    render(0);
    renderRanking();
    renderTeamScore();
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

  function shiftObjectTimers(obj,delta){
    if(!obj||!delta)return;
    for(const k of Object.keys(obj)){
      const v=obj[k];
      if(typeof v==="number" && v>0 && /(Until|At|Cooldown)$/.test(k)) obj[k]=v+delta;
    }
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
    const delta=Math.max(0,now-pauseStarted);
    paused=false;
    raceStart+=delta;
    players.forEach(p=>shiftObjectTimers(p,delta));
    observers.forEach(o=>shiftObjectTimers(o,delta));
    if(replayLastCapture) replayLastCapture+=delta;
    if(lastRankingRender) lastRankingRender+=delta;
    if(lastLiveStatsRender) lastLiveStatsRender+=delta;
    if(commentaryLastAt) commentaryLastAt+=delta;
    if(commentaryLastGeneralAt) commentaryLastGeneralAt+=delta;
    if(lastCloseBattleEventAt) lastCloseBattleEventAt+=delta;
    if(broadcastStoryUntil) broadcastStoryUntil+=delta;
    if(broadcastTickerUntil) broadcastTickerUntil+=delta;
    if(raceEventUntil) raceEventUntil+=delta;
    pauseStarted=0;
    lastTs=now;
    simClock=now;
    simAccumulator=0;
    if(pauseBtn){pauseBtn.textContent="⏸ 일시정지";pauseBtn.classList.remove("paused");}
    raf=requestAnimationFrame(loop);
  }

  function start(){
    if(running) return;
    paused=false;
    if(pauseBtn){pauseBtn.textContent="⏸ 일시정지";pauseBtn.classList.remove("paused");}
    if(players.every(p=>p.done)) return;
    running=true;
    const now=performance.now();
    if(!raceStart){
      raceStart=now;
      // v2.43: LIVE commentary UI removed.
      // v2.14: each racer gets a small stat-driven launch quality.
      // This is a start skill effect, not comeback rubber-banding.
      for(let i=0;i<players.length;i++){
        const p=players[i];
        const start=(p.stats.start-72)/27;
        const reaction=(p.stats.reaction-72)/27;
        const accel=(p.stats.acceleration-72)/27;
        const focus=(p.stats.focus-72)/27;
        const pressure=(p.stats.pressure-72)/27;
        const consistency=(p.stats.consistency-72)/27;
        const skill=(start*.34+reaction*.25+accel*.16+focus*.13+pressure*.12);

        // Reaction delay is small (tens of milliseconds) but visible in close starts.
        // Better reaction/focus/start stats reduce it; consistency narrows the random swing.
        const reactionNoise=(Math.random()-.5)*(34-consistency*12);
        p.startReactionMs=Math.max(18,Math.min(115,
          94-reaction*30-focus*18-start*13-pressure*7+reactionNoise-(p.raceForm-1)*90));
        p.startExecution=Math.max(.965,Math.min(1.035,
          .985+skill*.043+(p.raceForm-1)*.18+(Math.random()-.5)*(.014-consistency*.004)));

        const jitter=(Math.random()-.5)*(.016-consistency*.005);
        p.startLaunchMul=Math.max(.965,Math.min(1.045,.984+skill*.050+jitter+(p.raceForm-1)*.16));
        p.startLaunchUntil=now+1750+Math.random()*350;
      }
    }
    lastTs=now;
    simClock=now; simAccumulator=0;
    rebuildObserverGrid();
    precomputeObserverPredictions();
    startBtn.textContent="진행 중";
    raf=requestAnimationFrame(loop);
  }

  function controlPreferenceWeights(p){
    // v2.11: each driving identity favors different manual-control choices.
    const name=p.drivingStyle.name;
    let w={zigzag:1.12,backcon:1.12,stopcon:.035,wide:1};
    if(name==="apexHunter")      w={zigzag:1.18,backcon:1.22,stopcon:.72,wide:.76};
    else if(name==="safeReader")w={zigzag:.84,backcon:.62,stopcon:1.48,wide:1.20};
    else if(name==="attacker")  w={zigzag:1.34,backcon:1.38,stopcon:.58,wide:.72};
    else if(name==="lineMaster")w={zigzag:.92,backcon:.88,stopcon:.86,wide:1.30};
    else if(name==="controller")w={zigzag:1.16,backcon:1.04,stopcon:1.22,wide:.82};
    else if(name==="patient")   w={zigzag:.78,backcon:.66,stopcon:1.34,wide:1.26};
    else if(name==="opportunist")w={zigzag:1.24,backcon:1.34,stopcon:.76,wide:.88};
    const id=identityOf(p);
    if(id.control && w[id.control]!=null && id.control!=="stopcon") w[id.control]*=1.16;
    // v2.51: stopcon is an emergency last resort only.
    w.stopcon*=.035;
    w.zigzag*=1.22;
    w.backcon*=1.28;
    return w;
  }

  function weightedControlPick(p,allowed){
    const w=controlPreferenceWeights(p);
    let total=0;
    for(let i=0;i<allowed.length;i++) total+=w[allowed[i]]||1;
    let r=Math.random()*total;
    for(let i=0;i<allowed.length;i++){
      r-=w[allowed[i]]||1;
      if(r<=0) return allowed[i];
    }
    return allowed[allowed.length-1];
  }

  function beginControl(p,mode,now,duration,reactive,threatId=-1){
    p.controlMode=mode;
    p.reactiveControl=reactive;
    p.reactiveThreatId=threatId;
    p.modeStart=now;
    p.controlUntil=now+duration;

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

  function chooseControl(p, now, dt){
    p.controlCooldown -= dt;
    p.reactiveControlCooldown -= dt;

    if(p.controlMode!=="normal" && now>=p.controlUntil){
      p.controlMode="normal";p.reactiveControl=false;p.reactiveThreatId=-1;
      p.controlQuality=1;p.controlMistakeSide=0;
    }

    const si=Math.min(p.seg,segs.length-1),s=segs[si];
    let immediate=null,immediateAlong=999,nearAhead=null,nearAlong=999;
    const closeObs=nearbyObservers(p.x,p.y,15.5);

    // Absolutely no stop/back/zigzag/wide control or artificial slowing on clear road.
    if(!closeObs.length){
      if(p.controlMode!=="normal" && !p.reactiveControl){
        p.controlMode="normal";p.controlUntil=0;p.controlQuality=1;p.controlMistakeSide=0;
      }
      return;
    }

    for(let i=0;i<closeObs.length;i++){
      const o=closeObs[i],dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy;if(along<=0)continue;
      const lat=Math.abs(dx*s.nx+dy*s.ny);
      if(along<4.8&&lat<2.5&&along<immediateAlong){immediate=o;immediateAlong=along;}
      if(along<10.8&&lat<5.0&&along<nearAlong){nearAhead=o;nearAlong=along;}
    }

    if(p.controlMode==="normal"&&p.reactiveControlCooldown<=0){
      const reaction=(p.stats.reaction-72)/27,control=(p.stats.control-72)/27;
      const prediction=(p.stats.prediction-72)/27,pressure=(p.stats.pressure-72)/27;

      if(immediate){
        // Active escape: diagonal planner already has first authority; manual backup
        // strongly favors backcon/zigzag. Stopcon is only a tiny last-resort chance.
        const r=Math.random();
        if(r<.035){
          beginControl(p,"stopcon",now,90+Math.random()*85,true,immediate.id);
          p.reactiveControlCooldown=3000+Math.random()*2600;
        }else if(r<.54){
          beginControl(p,"backcon",now,330+Math.random()*190,true,immediate.id);
          p.reactiveControlCooldown=1700+Math.random()*1800;
        }else{
          beginControl(p,"zigzag",now,300+Math.random()*260,true,immediate.id);
          p.reactiveControlCooldown=1450+Math.random()*1650;
        }
        return;
      }

      if(nearAhead){
        const zigChance=Math.min(.92,.62+reaction*.10+prediction*.10+pressure*.05);
        if(Math.random()<zigChance){
          beginControl(p,Math.random()<.72?"zigzag":"backcon",now,310+Math.random()*260,true,nearAhead.id);
          p.reactiveControlCooldown=1500+Math.random()*1900;return;
        }
      }
    }

    // Nearby observers exist but are not directly threatening: occasional moving
    // controls only. Never stop on this branch.
    if(p.controlMode==="normal"&&p.controlCooldown<=0){
      const ag=(p.profile.aggression-60)/40,ct=(p.profile.control-85)/15;
      const mode=weightedControlPick(p,["zigzag","backcon","wide"]);
      let duration=mode==="backcon"?330+Math.random()*190:mode==="zigzag"?350+Math.random()*270:480+Math.random()*300;
      duration*=(1.06-ct*.12);
      beginControl(p,mode,now,duration,false,-1);
      p.controlCooldown=(3600-ag*850)+Math.random()*(3900-ag*500);
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

  function specialInsideSide(si){
    if(!SPECIAL_INSIDE_SEGMENTS.has(si)) return 0;
    const direct=cornerInsideSide(si);
    if(direct) return direct;
    const future=futureInsideBias(si);
    return Math.abs(future)>.08 ? (future>0?1:-1) : 0;
  }

  function specialInsideTarget(p,si,now,off){
    const side=specialInsideSide(si);
    if(!side) return off;
    const skill=((p.stats.insideLine-72)/27)*.45+((p.stats.routeReading-72)/27)*.30+
      ((p.stats.cornering-72)/27)*.25;
    const localDanger=nearbyObservers(p.x,p.y,15).length;
    // v2.51: the user's hidden yellow guide is NORMAL drivable racing road.
    // It is not a special/rare shortcut. On a clear road the optimizer strongly
    // prefers this deeper apex; observers may override it for survival.
    const normalHalf=Math.max(1.8,widths[si]*.72);
    const deepHalf=Math.max(normalHalf,widths[si]*(1.13+skill*.075));
    const clearCommit=Math.max(.82,Math.min(.97,.86+skill*.08+(p.linePersonality||0)*.035));
    const dangerFade=localDanger>=8?.34:localDanger>=5?.55:localDanger>=2?.78:1;
    const commit=clearCommit*dangerFade;
    return off*(1-commit)+(side*deepHalf)*commit;
  }

  function clampSpecialRoadOffset(si,lateral){
    const normalHalf=Math.max(1.8,widths[si]*ROAD_MARGIN);
    const side=specialInsideSide(si);
    if(!side) return Math.max(-normalHalf,Math.min(normalHalf,lateral));
    const specialHalf=Math.max(normalHalf,widths[si]*1.24);
    const lo=side<0?-specialHalf:-normalHalf;
    const hi=side>0? specialHalf: normalHalf;
    return Math.max(lo,Math.min(hi,lateral));
  }

  function clampToRoad(p){
    const si=Math.min(p.seg,segs.length-1);
    const s=segs[si];

    // Project player onto current segment coordinates.
    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    let along=(rx*s.ux+ry*s.uy);
    let lateral=(rx*s.nx+ry*s.ny);

    // Standard corridor is preserved except for v2.43's hidden legal inside shortcuts.
    along=Math.max(-1.2,Math.min(s.L+2.2,along));
    lateral=clampSpecialRoadOffset(si,lateral);

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
    const laneOffsets=[-roadHalf*.92,-roadHalf*.46,0,roadHalf*.46,roadHalf*.92];
    const laneRisk=[0,0,0,0,0];
    const horizons=[.42,.95,1.70,2.85];
    let frontCount=0, closeCount=0, nearest=999;

    for(let hi=0;hi<horizons.length;hi++){
      const t=horizons[hi];
      const horizonWeight=hi===0?1.45:hi===1?1.0:.68;
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

    const situationRisk=Math.max(0,Math.min(.48,p.tacticalRisk||0));
    const id=identityOf(p), safetyBias=id.safety||1;
    const timeLoss=(1-speedMul)*(19.0+situationRisk*7.0)/Math.max(.90,safetyBias);
    const detour=Math.abs(targetOff-p.desiredOffset)*0.34*(2-safetyBias);
    return {score:danger*safetyBias+timeLoss+detour,minClear:Math.sqrt(minClearSq)};
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
    const nearby=nearestThreats(nearbyRaw,p,8);
    const predictionNorm=(p.stats.prediction-72)/27;
    const corridorBias=escapeCorridorBias(p,s,nearby);
    const clusterPlan=observerClusterPlan(p,s,nearby);
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
    const half=Math.max(3.6,widths[si]*(0.675-compactSkill*0.070+evadeNorm*0.035)*p.drivingStyle.safety);

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
        const skimMag=half*(.48+compactSkill*.12);
        const candA=Math.max(-half*.98,Math.min(half*.98,p.desiredOffset+sidePref*skimMag));
        const candB=Math.max(-half*.98,Math.min(half*.98,p.desiredOffset-sidePref*skimMag*.88));
        const riskA=candidateAvoidanceRisk(p,s,candA,.97,nearby);
        const riskB=candidateAvoidanceRisk(p,s,candB,.95,nearby);
        const chosen=riskA.score<=riskB.score
          ? {targetOff:candA,speedMul:.97,risk:riskA}
          : {targetOff:candB,speedMul:.95,risk:riskB};
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
      ? [-0.98,-0.78,-0.54,-0.28,0,0.28,0.54,0.78,0.98]
      : [-0.94,-0.62,-0.30,0,0.30,0.62,0.94];
    const movingSpeeds=clusterPlan.emergency ? [1.00,.88,.74,.60] : [1.00,.90,.78];
    let best=null;

    for(const frac of laneFracs){
      const targetOff=frac*half;
      for(const sm of movingSpeeds){
        const r=candidateAvoidanceRisk(p,s,targetOff,sm,nearby);
        const side=Math.sign(targetOff);
        const corridorBonus=(side!==0 && Math.sign(corridorBias)===side) ? corridorCommit*7.2 : 0;
        const clusterDistance=Math.abs(targetOff-clusterPlan.preferredOffset)/Math.max(1,half);
        const clusterBonus=(1-Math.min(1,clusterDistance))*clusterPlan.confidence*13.0;
        const centerPenalty=(clusterPlan.frontCount>=3 && Math.abs(frac)<.20)
          ? clusterPlan.density*7.5 : 0;
        const candidate={
          mode:"planned",
          targetOff,
          speedMul:sm,
          score:r.score-corridorBonus-clusterBonus+centerPenalty,
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
      // v2.26: stopping is the last resort. Recent stop usage raises its cost,
      // reducing stop-go-stop loops when a moving corridor exists.
      score:stopRisk.score + 11.5 + (p.tacticalRisk||0)*12.0
        + (p.drivingStyle.attack-1)*18
        - (p.drivingStyle.safety-1)*12
        + ((p.stats.braking-85)/14)*-1.8
        + ((p.match.stops||0)>0 ? Math.min(6,p.match.stops*1.1) : 0),
      minClear:stopRisk.minClear
    };

    const riskClearance=Math.max(.98,1.15-(p.tacticalRisk||0)*.22);
    const movingUnsafe=!best || best.minClear<riskClearance || best.score>275;
    if(movingUnsafe && (!best || stopCandidate.score<best.score*1.04)){
      best=stopCandidate;
    }

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
    if(best.mode==="stop") p.match.stops++;
    const clusterHold=clusterPlan.confidence>.30 ? 120+clusterPlan.confidence*170 : 0;
    p.avoidPlanUntil=now+(emergency
      ? Math.max(185,265-(react-85)*4)+Math.random()*65
      : Math.max(350,baseHold+clusterHold)+Math.random()*130);
    return best;
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
    return {rank,progress:my,remaining:Math.max(0,routeLength-my),nearestAheadGap};
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
    risk += prediction*.025 + riskControl*.018;
    risk += (p.raceForm-1)*(.30+pressure*.08);
    if(rs.rank===1) risk-=.10;                 // leader protects the race more often
    else if(rs.rank===2 && progressRatio>.78) risk+=.045;
    if(progressRatio>.88 && rs.rank>=3) risk+=.035+pressure*.018;
    risk=Math.max(0,Math.min(.48,risk));

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
    const nearby=nearbyObservers(p.x,p.y,12.5);
    let chosen=0;

    if(nearby.length<=2 && rs.nearestAheadGap<4.6){
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
    const nearby=nearbyObservers(p.x,p.y,11.5);
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
    const chance=.013 + aggression*.010 + insideSkill*.008 + pressure*.005;
    if(Math.random()<chance){
      p.variantMode=1;
      p.variantSide=inside;
      const identity=identityOf(p);
      p.variantStrength=Math.min(.995,(.88+insideSkill*.07+control*.025)*(identity.apex||1));
      p.variantUntil=now+520+Math.random()*620;
      p.variantCooldown=now+8500+Math.random()*8500;
      return baseOff*(1-p.variantStrength)+inside*half*p.variantStrength;
    }

    p.variantCooldown=now+2200+Math.random()*3000;
    return baseOff;
  }


  // v2.13: dedicated overtake/comeback planner.
  // It never gives a trailing racer extra base speed. It only changes line choice,
  // timing, and risk according to the next corner and observer layout.
  function overtakePlan(p,si,now){
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.57);

    if(now<p.passPlanUntil && p.passPlanMode){
      return {off:p.passPlanOffset,speedMul:p.passPlanSpeedMul,mode:p.passPlanMode};
    }
    if(p.passPlanMode && now>=p.passPlanUntil){
      p.passPlanMode=0;
      p.passTargetId=-1;
      p.passPlanSpeedMul=1;
    }
    if(now<p.passPlanCooldown) return null;

    const myProg=currentProgress(p);
    let target=null, gap=999;
    for(let i=0;i<players.length;i++){
      const q=players[i];
      if(q===p || q.done) continue;
      const g=currentProgress(q)-myProg;
      if(g>0 && g<8.2 && g<gap){ target=q; gap=g; }
    }
    if(!target){
      p.passPlanCooldown=now+420+Math.random()*360;
      return null;
    }

    const rs=liveRaceSituation(p);
    const progressRatio=Math.max(0,Math.min(1,myProg/routeLength));
    const inside=cornerInsideSide(si);
    const future=futureInsideBias(si);
    const corner=cornerIntensity(si);
    const aggression=(p.stats.aggression-72)/27;
    const prediction=(p.stats.prediction-72)/27;
    const routeRead=(p.stats.routeReading-72)/27;
    const pressure=(p.stats.pressure-72)/27;
    const control=(p.stats.control-72)/27;
    const riskControl=(p.stats.riskControl-72)/27;

    // Estimate which side has more observer room over the immediate approach.
    const nearby=nearbyObservers(p.x,p.y,15.0);
    let leftRisk=0,rightRisk=0,frontRisk=0;
    const s=segs[Math.min(si,segs.length-1)];
    for(let i=0;i<nearby.length;i++){
      const o=nearby[i], dx=o.x-p.x, dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy;
      if(along<-.5 || along>12.5) continue;
      const lat=dx*s.nx+dy*s.ny;
      const w=Math.max(.2,1-along/14);
      if(Math.abs(lat)<2.0) frontRisk+=w;
      if(lat<1.2) leftRisk+=w; else rightRisk+=w;
    }

    const trailingNeed=Math.max(0,(rs.rank-2)/6);
    const late=Math.max(0,(progressRatio-.55)/.45);
    const id=identityOf(p);
    const attack=(.18+aggression*.18+prediction*.10+routeRead*.09+pressure*.10+
      trailingNeed*(.16+late*.18)+(p.raceForm-1)*.24)*(id.pass||1);
    if(Math.random()>Math.min(.76,attack)){
      p.passPlanCooldown=now+(520+Math.random()*620)*(id.patience||1);
      return null;
    }

    let mode=0, off=0, speedMul=1;
    const cornerSide=inside!==0?inside:(Math.abs(future)>.12?Math.sign(future):0);
    const saferSide=leftRisk<=rightRisk?-1:1;

    // 1) Immediate inside attack: best when a corner is arriving and the apex is usable.
    const insideRisk=cornerSide<0?leftRisk:rightRisk;
    if(cornerSide!==0 && (corner>.04 || Math.abs(future)>.15) &&
       insideRisk<2.15 && (aggression+control+routeRead)>.75){
      mode=1;
      const commit=Math.min(.995,.78+aggression*.08+control*.07+routeRead*.07+late*.04);
      off=cornerSide*half*commit;
      speedMul=.995;
    }
    // 2) Outside setup: go wide now to obtain a cleaner entry/cut on the next corner.
    else if(cornerSide!==0 && frontRisk>1.0 && (prediction+routeRead+riskControl)>.95){
      mode=2;
      off=-cornerSide*half*Math.min(.88,.58+prediction*.10+routeRead*.10);
      speedMul=.965+control*.018;
    }
    // 3) Wait-and-cut: when the lane directly ahead is crowded, lose a tiny amount
    // of momentum for a moment and attack the clearer side. This creates passes
    // through timing, not rubber-band acceleration.
    else if(frontRisk>.72 && Math.min(leftRisk,rightRisk)<frontRisk*.86){
      mode=3;
      off=saferSide*half*Math.min(.93,.62+prediction*.12+pressure*.08);
      speedMul=.91+control*.025;
    }
    else {
      // Open straight: commit to the clearer side to set up a conventional pass.
      mode=1;
      off=saferSide*half*Math.min(.82,.50+aggression*.10+prediction*.08);
      speedMul=.99;
    }

    p.passPlanMode=mode;
    p.passPlanOffset=off;
    p.passPlanSpeedMul=speedMul;
    if(p.match && p.match.passPlans){
      if(mode===1) p.match.passPlans.inside++;
      else if(mode===2) p.match.passPlans.outside++;
      else if(mode===3) p.match.passPlans.waitCut++;
    }
    p.passTargetId=target.index;
    p.passPlanUntil=now+(mode===3?260:420)+Math.random()*(mode===2?360:260);
    p.passPlanCooldown=now+900+Math.random()*1250;
    return {off,speedMul,mode};
  }

  function packContextOffset(p,si,now){
    const s=segs[Math.min(si,segs.length-1)];
    const half=Math.max(1.8,widths[si]*0.56);

    if(now<p.packPlanUntil) return p.packPlanOffset;

    const myProg=currentProgress(p);
    let nearestAhead=null, nearestGap=999;
    for(let i=0;i<players.length;i++){
      const q=players[i];
      if(q===p || q.done) continue;
      const gap=currentProgress(q)-myProg;
      if(gap>0 && gap<12.5 && gap<nearestGap){
        nearestAhead=q;
        nearestGap=gap;
      }
    }

    if(!nearestAhead){
      p.packPlanOffset=0;
      p.packPlanUntil=now+300;
      return 0;
    }

    const q=nearestAhead;
    const qOff=((q.x-s.a[0])*s.nx+(q.y-s.a[1])*s.ny);
    const myOff=((p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny);
    const aggression=(p.stats.aggression-72)/27;
    const pressure=(p.stats.pressure-72)/27;
    const control=(p.stats.control-72)/27;
    const inside=cornerInsideSide(si);

    // Players are non-solid. This is only a tactical passing-line choice:
    // racers may still overlap completely with no push, collision, or slowdown.
    let side=(qOff>=myOff)?-1:1;
    if(inside!==0 && Math.abs(qOff-inside*half)>half*.34 &&
       (p.drivingStyle.name==="opportunist" || p.drivingStyle.name==="attacker" || aggression>.62)){
      side=inside;
    }

    let commitment=.40;
    if(p.drivingStyle.name==="safeReader" || p.drivingStyle.name==="patient") commitment=.32;
    else if(p.drivingStyle.name==="attacker" || p.drivingStyle.name==="opportunist") commitment=.69;
    else if(p.drivingStyle.name==="controller") commitment=.46;

    commitment+=aggression*.09+pressure*.06+control*.035;
    if(nearestGap<3.2) commitment+=.12;
    if(nearestGap<1.35) commitment+=.06;

    p.packPlanOffset=side*half*Math.min(.90,commitment);
    p.packPlanUntil=now+(nearestGap<2.25?250:340)+Math.random()*130;
    return p.packPlanOffset;
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

    // No current corner: prepare the next corner from the outside, then cross
    // smoothly toward its apex as the turn approaches.
    if(seq.currentSide===0 && seq.nextSide!==0){
      const approach=-seq.nextSide*half*(.42+.22*precision);
      return {target:approach,weight:.18+.18*routeRead,seq};
    }

    if(seq.currentSide!==0){
      // Early approach stays a little wider; middle/end commits to the apex.
      // At corner exit, begin positioning for the following corner when useful.
      if(phase<.32){
        const outside=-seq.currentSide*half*(.28+.18*precision);
        return {target:outside,weight:.22+.18*cornerSkill,seq};
      }
      if(phase<.78){
        const apex=seq.currentSide*half*(.91+.085*precision);
        return {target:apex,weight:.40+.25*precision,seq};
      }
      if(seq.nextSide!==0){
        const exitPrep=-seq.nextSide*half*(.30+.20*routeRead);
        return {target:exitPrep,weight:.20+.20*routeRead,seq};
      }
    }
    return {target:0,weight:0,seq};
  }

  function creativeRouteAdjustment(p,si,now,baseOff){
    const progress=Math.max(0,Math.min(1,currentProgress(p)/routeLength));
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.54);
    const danger=nearbyObservers(p.x,p.y,18).length, lp=p.linePersonality||0;
    // Dense fields temporarily raise the creative-route allowance and reduce
    // the trigger threshold. Normal sections remain close to the v2.41 70/30 mix.
    const denseBoost=danger>=8?.16:danger>=5?.11:danger>=3?.055:0;
    const targetCreative=progress*Math.min(.55,p.creativeRouteBudget+denseBoost);
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
      p.creativeModeUntil=now+(dense?720:520)+Math.random()*(dense?1350:1150);
      p.creativeCooldown=now+(dense?560:820)+Math.random()*(dense?900:1280);
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
          beginControl(p,Math.random()<.72?"zigzag":"backcon",now,280+Math.random()*240,true,-1);
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
    const half=Math.max(1.8,widths[si]*(0.535+lineNorm*0.060));

    // v31: when the local road is genuinely clear of observers, commit to a
    // near-wall Kart-style apex instead of wasting space in the middle.
    const cornerSide=cornerInsideSide(si);
    const cornerPower=cornerIntensity(si);
    const localObs=nearbyObservers(p.x,p.y,18.0);
    if(localObs.length===0 && cornerSide!==0 && cornerPower>0.055){
      // v2.34: clear road no longer sends every racer to the identical 99.5% apex.
      // Aggressive/inside specialists cut tighter; safety styles intentionally leave margin.
      const lp=p.linePersonality||0;
      const skill=(p.stats.insideLine+p.stats.cornering+p.stats.routeReading)/3;
      const skillN=(skill-72)/27;
      const commit=Math.max(.56,Math.min(.995,.76+lp*.20+skillN*.055));
      p.linePlanOffset=cornerSide*half*commit;
      p.linePlanUntil=now+300+Math.random()*100;
      return p.linePlanOffset;
    }

    const candidates=[-0.995,-0.82,-0.64,-0.44,-0.22,0,0.22,0.44,0.64,0.82,0.995];
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
        const h=Math.max(1.6,widths[j]*0.56);

        let futureOff=off*(0.56-routeRead*.09);
        if(Math.abs(turn)>0.025){
          const inside=(turn>0 ? 1 : -1);
          const apexCommit=0.86+routeRead*.10+((p.stats.insideLine-72)/27)*.055;
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

      // Strong opening shortcut: 7→5 should ride the upper wall because the
      // following road turns upward. In screen coordinates, upper = smaller y.
      if(si<=8){
        const projectedY=s.b[1]+s.ny*off;
        score += Math.max(0,projectedY-151.2)*2.8;
        score -= Math.max(0,154.5-projectedY)*0.65;
      }

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

      // Avoid wall scraping while still allowing near-apex lines.
      // Skilled racers pay a smaller penalty and can exploit millimetre-like edge gains.
      const edgeSkill=((p.stats.cornering+p.stats.insideLine+p.stats.control)/3-72)/27;
      score += Math.pow(Math.abs(c),5)*(.24-edgeSkill*.10);

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

  function stabilizeDrivingLine(p,si,targetOff){
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.54);
    const density=nearbyObservers(p.x,p.y,15).length;
    const corner=cornerIntensity(si);
    const lineSkill=((p.stats.cornering+p.stats.insideLine+p.stats.control)/3-72)/27;

    // v2.27: on a genuinely clear corner, high-skill racers may use the full
    // extreme inside edge. Traffic progressively restores a larger safety margin.
    let edge;
    if(density===0 && corner>.045) edge=.995;
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
    if(p.humanMode===1){
      off+=Math.sin(now*.012+p.humanPhase)*half*(.055+(1-control)*.09);
    }else if(p.humanMode===2){
      speedMul=.945+reaction*.028+prediction*.020;
    }else if(p.humanMode===3){
      const side=baseOff>=0?1:-1;
      off+=side*half*(.07+(1-risk)*.08);
      speedMul=.982;
    }

    if(now>=p.decisionErrorUntil){
      const errorChance=.0012+(1-(reaction+prediction+stability)/3)*.0048;
      if(Math.random()<errorChance) p.decisionErrorUntil=now+170+Math.random()*210;
    }
    if(now<p.decisionErrorUntil){
      off+=Math.sin(now*.018+p.index)*half*(.025+(1-stability)*.045);
      speedMul*=.988;
    }
    // v2.45: persistent individual route identity keeps racers from stacking
    // on the same optimized line even when no observer forces a deviation.
    const identityWave=Math.sin(now*.00115+p.routeIdentityPhase)*half*.10;
    const identityBias=(p.routeIdentityBias||0)*half*.24;
    off=off*.79 + identityBias + identityWave;
    off=creativeRouteAdjustment(p,si,now,off);
    return {off:Math.max(-half*.995,Math.min(half*.995,off)),speedMul};
  }

  function optimizedLookAheadTarget(p,si,now){
    const routeRead=(p.stats.routeReading-72)/27;
    const maxAhead=Math.min(segs.length-1,si+4+Math.round(routeRead*2));
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
      const skill=((p.stats.cornering+p.stats.insideLine+p.stats.routeReading)/3-72)/27;
      targetOff=(strongest>0 ? 1 : -1)*half*Math.min(.997,.94+skill*.057);
    }

    const phase=cornerPhaseTarget(p,si,Math.max(1.8,widths[si]*.56));
    if(phase.weight>.20){
      const blend=Math.min(.34,.12+phase.weight*.32);
      targetOff=targetOff*(1-blend)+phase.target*blend;
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


  // v2.14: start / finish / clutch situation logic.
  // No trailing-speed bonus: late-race changes are route/risk/decision changes only.
  function clutchRacePlan(p,si,now){
    const prog=currentProgress(p);
    const ratio=Math.max(0,Math.min(1,prog/routeLength));
    if(ratio<.78) return null;

    const rs=liveRaceSituation(p);
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.575);
    const pressure=(p.stats.pressure-72)/27;
    const focus=(p.stats.focus-72)/27;
    const control=(p.stats.control-72)/27;
    const aggression=(p.stats.aggression-72)/27;
    const riskControl=(p.stats.riskControl-72)/27;
    const prediction=(p.stats.prediction-72)/27;
    const consistency=(p.stats.consistency-72)/27;
    const inside=cornerInsideSide(si);
    const future=futureInsideBias(si);
    const nearby=nearbyObservers(p.x,p.y,12.0);

    if(now<p.clutchDecisionUntil){
      return {off:p.clutchLineOffset,speedMul:p.clutchSpeedMul};
    }

    // Detect a real finish fight using nearby progress, not physical contact.
    let nearestGap=999, nearestBehind=999;
    for(let i=0;i<players.length;i++){
      const q=players[i];
      if(q===p || q.done) continue;
      const g=currentProgress(q)-prog;
      if(g>0 && g<nearestGap) nearestGap=g;
      if(g<0 && -g<nearestBehind) nearestBehind=-g;
    }
    const closeFight=Math.min(nearestGap,nearestBehind)<5.3;
    const veryLate=ratio>.90;
    const finalSprint=ratio>.955;
    const leaderProtect=rs.rank===1;
    const chasing=rs.rank>=2 && nearestGap<7.0;

    let off=0, speedMul=1;
    const cornerSide=inside!==0?inside:(Math.abs(future)>.12?Math.sign(future):0);

    if(leaderProtect){
      // Leaders with good focus/risk-control prefer a clean, stable line.
      const safe=(focus*.38+riskControl*.34+consistency*.28);
      if(cornerSide!==0 && nearby.length<=1){
        const commit=Math.min(.90,.58+safe*.20);
        off=cornerSide*half*commit;
      }
      // Protecting the lead means line choice, never a hidden speed bonus.
      if(finalSprint && nearby.length===0 && cornerSide!==0){
        off=cornerSide*half*Math.min(.985,.74+safe*.18);
      }
      speedMul=1;
    } else if(chasing && closeFight){
      // Chasers may take a more decisive route in the final section.
      const clutch=(pressure*.34+control*.24+prediction*.22+aggression*.20);
      const gambleChance=Math.min(.62,.18+clutch*.28+(veryLate?.12:0));
      if(Math.random()<gambleChance && nearby.length<=1){
        let side=cornerSide;
        if(side===0) side=(p.index%2?1:-1);
        const commit=Math.min(.995,.72+clutch*.18+(veryLate?.05:0));
        off=side*half*commit;
      } else if(nearby.length>1){
        // In danger, high-pressure racers pick the cleaner escape rather than blindly force a pass.
        const s=segs[Math.min(si,segs.length-1)];
        let left=0,right=0;
        for(let i=0;i<nearby.length;i++){
          const o=nearby[i],dx=o.x-p.x,dy=o.y-p.y;
          const along=dx*s.ux+dy*s.uy;
          if(along<0 || along>10) continue;
          const lat=dx*s.nx+dy*s.ny;
          if(lat<0) left++; else right++;
        }
        off=(left<=right?-1:1)*half*(.48+prediction*.18);
      }
      // In the final 4.5%, a close chaser commits harder to the shortest safe apex.
      if(finalSprint && nearby.length===0){
        let finishSide=cornerSide||((p.index%2)?1:-1);
        off=finishSide*half*Math.min(.995,.82+clutch*.15);
      }
      speedMul=1;
    } else if(veryLate && rs.rank>=4){
      // Deep in the pack near the finish: more risk, but still no raw speed boost.
      const clutch=(pressure+aggression+control)/3;
      if(Math.random()<(.10+clutch*.16) && nearby.length===0){
        let side=cornerSide||((p.index%2)?1:-1);
        off=side*half*Math.min(.98,.72+clutch*.20);
      }
    }

    p.clutchLineOffset=off;
    p.clutchSpeedMul=speedMul;
    p.clutchDecisionUntil=now+260+Math.random()*280;
    return {off,speedMul};
  }

  function updatePlayer(p, now, dt){
    if(p.done) return;

    // v2.29 start reaction: milliseconds matter without changing base pace.
    if(raceStart && now-raceStart<p.startReactionMs) return;

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
    // Players are non-solid. Pack logic only adds subtle tactical route variety.
    const packWeight=Math.min(0.25,0.08+(p.drivingStyle.pack-0.90)*0.40);
    const identityWeight=.13;
    const identityOff=(p.routeIdentityBias||0)*Math.max(1.8,widths[si]*.54);
    targetOff=targetOff*.12+plannedOff*(.75-packWeight-identityWeight)+packOff*packWeight+identityOff*identityWeight;
      // Kart-style cornering: aggressively approach the inside/apex on turns.
      const insideSide=cornerInsideSide(si);
      const turnPower=cornerIntensity(si);
      if(insideSide!==0 && turnPower>0.055){
        const halfRoad=Math.max(1.8,widths[si]*0.58);
        const apexOff=insideSide*halfRoad*INSIDE_CORNER_STRENGTH;
        const apexBlend=Math.min(0.965,0.66+turnPower*1.72);
        targetOff=targetOff*(1-apexBlend)+apexOff*apexBlend;
      }

      // Look ahead several route segments so the racer hugs the inside wall before
      // the corner actually begins instead of waiting until the midpoint.
      const futureInside=futureInsideBias(si);
      if(Math.abs(futureInside)>0.10){
        const halfRoad2=Math.max(1.8,widths[si]*0.59);
        const futureApex=futureInside*halfRoad2*0.998;
        targetOff=targetOff*0.28+futureApex*0.72;
      }

    // Lower line skill adds slightly more steering error, while everyone still
    // follows the optimized racing line most of the time.
    const lineError=(100-p.profile.line)/100;
    const precision=(p.stats.insideLine+p.stats.cornering+p.stats.routeReading)/300;
    const precisionNoise=0.007+(1-precision)*0.225;
    targetOff += Math.sin((now/1000)*0.7+p.index*1.3)*half*precisionNoise;

    // High inside-line racers visibly hold a tighter apex; lower line skill leaves
    // a little more safety margin, making player identities readable in motion.
    const insideNow=cornerInsideSide(si);
    if(insideNow!==0 && cornerIntensity(si)>0.06){
      const insideCommit=(p.stats.insideLine-72)/27;
      const styleApex=(p.drivingStyle.name==="attacker"||p.drivingStyle.name==="apexHunter")?.055:
        (p.drivingStyle.name==="safeReader"||p.drivingStyle.name==="patient")?-.075:0;
      const personalityApex=(p.linePersonality||0)*.095;
      const skillApex=insideNow*half*Math.min(.995,Math.max(.54,0.69+insideCommit*0.23+styleApex+personalityApex));
      targetOff=targetOff*(0.40-insideCommit*0.12)+skillApex*(0.60+insideCommit*0.12);
    }

    const passPlan=overtakePlan(p,si,now);
    if(passPlan){
      // Strong enough to be visible, but observer avoidance below still has final authority.
      const passBlend=passPlan.mode===1?.66:passPlan.mode===2?.58:.52;
      targetOff=targetOff*(1-passBlend)+passPlan.off*passBlend;
    }

    const clutchPlan=clutchRacePlan(p,si,now);
    if(clutchPlan && Math.abs(clutchPlan.off)>.01){
      // Final-section decisions are visible, but avoidance below keeps final authority.
      targetOff=targetOff*.38+clutchPlan.off*.62;
    }

    targetOff=tacticalSituationOffset(p,si,now,targetOff);
    targetOff=tacticalVariantOffset(p,si,now,targetOff);
    targetOff=stabilizeDrivingLine(p,si,targetOff);
    const humanDrive=humanDrivingAdjustment(p,si,now,targetOff);
    targetOff=humanDrive.off;
    targetOff=specialInsideTarget(p,si,now,targetOff);

    let speedMul=humanDrive.speedMul;
    if(passPlan) speedMul*=passPlan.speedMul;
    if(clutchPlan) speedMul*=clutchPlan.speedMul;
    if(now<p.startLaunchUntil){
      // Only the opening launch is affected; after ~2 s everyone returns to normal pace.
      speedMul*=p.startLaunchMul*p.startExecution;
    }
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
        speedMul*=avoid.speedMul;
      }
    }
    if(!avoid && p.avoidPlanUntil && now>=p.avoidPlanUntil){
      p.avoidRecoverOffset=p.avoidPlanOffset;
      const recovery=(p.stats.recovery-72)/27;
      p.avoidRecoverUntil=now+(260-recovery*75);
      p.avoidPlanOffset=targetOff;
      p.avoidPlanSpeedMul=1;
      p.avoidPlanRisk=0;
      p.avoidPlanUntil=0;
    }
    if(!avoid && now<p.avoidRecoverUntil){
      const recovery=(p.stats.recovery-72)/27;
      const duration=Math.max(150,260-recovery*75);
      const remain=Math.max(0,Math.min(1,(p.avoidRecoverUntil-now)/duration));
      targetOff=targetOff*(1-remain*.30)+p.avoidRecoverOffset*(remain*.30);
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
    } else if(controlCanOverride && p.controlMode==="backcon"){
      const elapsed=now-p.modeStart;
      const reverseMs=(p.reactiveControl
        ? Math.max(115,190-controlSkill*45)
        : Math.max(170,275-controlSkill*75))*(failedControl?1.22:1);

      // Failed back-control loses extra time/line accuracy, but does not target a collision.
      if(p.reactiveControl){
        const escapeSide=failedControl?p.controlMistakeSide:(p.index%2?1:-1);
        targetOff += escapeSide*half*(.16+controlSkill*.05)*(failedControl?1.28:1);
        speedMul = elapsed<reverseMs
          ? (-0.44+controlSkill*.05)
          : ((1.16+controlSkill*.055)*(failedControl?.88:1));
      }else{
        targetOff += Math.sin(now*0.024+p.index)*half*(0.34+controlSkill*0.07)*(failedControl?1.15:1);
        speedMul = elapsed<reverseMs
          ? (-0.28+controlSkill*.05)
          : ((1.08+controlSkill*.06)*(failedControl?.90:1));
      }
    } else if(controlCanOverride && p.controlMode==="stopcon"){
      // v2.20: failed stop-control duration is extended once in beginControl.
      speedMul=0;
    } else if(!avoid && p.controlMode==="wide"){
      const side=(failedControl?p.controlMistakeSide:(p.index%2?1:-1));
      targetOff += side*half*(0.52+controlSkill*0.07)*(failedControl?1.12:1);
      speedMul=(0.895+controlSkill*0.055)*(failedControl?.91:1);
    }
targetOff=clampSpecialRoadOffset(si,targetOff);
    const steerControl=(p.stats.control-72)/27;
    const steerTurn=cornerIntensity(si);
    const steerEase=Math.min(.082,dt*(.00245+steerControl*.00055+steerTurn*.00045));
    p.desiredOffset += (targetOff-p.desiredOffset)*steerEase;

    // Look ahead to create smoother apex cutting.
    const next=segs[Math.min(segs.length-1,si+1)];
    let tx=s.b[0]+s.nx*p.desiredOffset;
    let ty=s.b[1]+s.ny*p.desiredOffset;
    const optTarget=optimizedLookAheadTarget(p,si,now);
    const optBlend = si<=8 ? 0.84 : 0.56;
    tx=tx*(1-optBlend)+optTarget.x*optBlend;
    ty=ty*(1-optBlend)+optTarget.y*optBlend;

    if(next && si<segs.length-1){
      const look=si<=8 ? 0.045 : 0.18;
      const nx=next.b[0]+next.nx*p.desiredOffset;
      const ny=next.b[1]+next.ny*p.desiredOffset;
      tx=tx*(1-look)+nx*look;
      ty=ty*(1-look)+ny*look;
    }

    let dx=tx-p.x, dy=ty-p.y;
    const d=Math.hypot(dx,dy) || 1;
    const ndx=dx/d, ndy=dy/d;
    const steerBlend=Math.min(.24,.12+((p.stats.control-72)/27)*.07+cornerIntensity(si)*.06);
    p.steerX += (ndx-p.steerX)*steerBlend;
    p.steerY += (ndy-p.steerY)*steerBlend;
    const steerLen=Math.hypot(p.steerX,p.steerY)||1;
    const step=p.speed*speedMul*dt/1000;
    const move=step>=0 ? Math.min(step,d) : Math.max(step,-0.55);
    p.x += p.steerX/steerLen*move;
    p.y += p.steerY/steerLen*move;

    // Never allow AI steering to drift into black/non-drivable areas.
    clampToRoad(p);
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

    rescueIfStuck(p,now);

    // v2.50 danger + near miss telemetry.
    if(!safeAt(p.x,p.y)){let nearestObsSq=Infinity;for(const o of nearbyObservers(p.x,p.y,3)){const dx=p.x-o.x,dy=p.y-o.y,d2=dx*dx+dy*dy;if(d2<nearestObsSq)nearestObsSq=d2;}if(nearestObsSq<10.24)p.match.dangerExposureMs+=dt;const hitSq=PLAYER_HIT_RADIUS*PLAYER_HIT_RADIUS;if(nearestObsSq>hitSq&&nearestObsSq<1.1664&&now-(p.match.lastNearMissAt||0)>420){p.match.nearMisses++;if(nearestObsSq<.3844)p.match.extremeNearMisses++;p.match.lastNearMissAt=now;addAutoHighlight("NEAR_MISS",`NEAR MISS · ${p.name}`,now,p.index,nearestObsSq<.3844?2:1);}}

    // Players are non-solid and may overlap completely.
    // Collision here is observer-only: player-player contact never pushes, slows, or stops anyone.
    // Collision check: actual observer contact = guaranteed stop outside invincible safe zones.
    if(!safeAt(p.x,p.y) && now>=p.invUntil && now>=p.collisionLockUntil){
      for(const o of nearbyObservers(p.x,p.y,PLAYER_HIT_RADIUS+1.0)){
        if(Math.abs(o.x-p.x)>PLAYER_HIT_RADIUS || Math.abs(o.y-p.y)>PLAYER_HIT_RADIUS) continue;
        const cdx=p.x-o.x, cdy=p.y-o.y;
        if(cdx*cdx+cdy*cdy<PLAYER_HIT_RADIUS*PLAYER_HIT_RADIUS){
          p.hits++;
          p.hitFxUntil=now+240;
          p.hitGrayUntil=now+STUN_MS;
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

    for(let oi=0;oi<observers.length;oi++){
      const o=observers[oi];
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
  let broadcastFocusId=-1;
  let broadcastFocusUntil=0;
  let previousUiRanks=new Map();
  let diagFrames=0, diagFps=0, diagLastFpsTs=0, diagFrameMs=0, diagMaxFrameMs=0;
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

  function resetCommentary(){
    commentaryItems=[];commentaryLastKey="";commentaryLastAt=0;commentaryLastGeneralAt=0;
    const feed=document.getElementById("commentaryFeed"),lead=document.getElementById("commentaryLead"),round=document.getElementById("commentaryRound");
    if(feed) feed.innerHTML="";
    if(lead) lead.textContent="출발 준비! 선수들이 스타트 라인에 섰습니다.";
    if(round) round.textContent=`${currentRound}R`;
  }
  function commentaryLine(key,text,now=performance.now(),force=false){
    if(!force&&key===commentaryLastKey&&now-commentaryLastAt<2600)return;
    if(!force&&now-commentaryLastAt<900)return;
    commentaryLastKey=key;commentaryLastAt=now;
    commentaryItems.unshift({text,time:raceStart?Math.max(0,now-raceStart):0});
    if(commentaryItems.length>7)commentaryItems.length=7;
    const lead=document.getElementById("commentaryLead"),feed=document.getElementById("commentaryFeed");
    if(lead)lead.textContent=text;
    if(feed)feed.innerHTML=commentaryItems.map((x,i)=>`<div class="commentary-line ${i===0?"latest":""}"><span>${(x.time/1000).toFixed(1)}초</span><b>${x.text}</b></div>`).join("");
  }
  function updateLiveCommentary(now){
    const ordered=liveOrderedPlayers();if(!ordered.length)return;
    const p1=ordered[0],p2=ordered[1],p3=ordered[2],frac=Math.max(0,Math.min(1,currentProgress(p1)/routeLength));
    const g12=broadcastGapSeconds(p1,p2),g23=broadcastGapSeconds(p2,p3);
    const round=document.getElementById("commentaryRound");if(round)round.textContent=`${currentRound}R · ${(frac*100).toFixed(0)}%`;
    if(frac>.94&&g12!=null&&g12<.20){commentaryLine(`finish-${p1.index}-${p2.index}`,`${p1.name} 선두! ${p2.name}이 바로 뒤에서 결승선을 노립니다. 마지막까지 모릅니다!`,now);return;}
    if(g12!=null&&g12<.24){commentaryLine(`fight-${p1.index}-${p2.index}`,`${p1.name}과 ${p2.name}, 선두 싸움이 붙었습니다. 격차가 ${g12.toFixed(2)}초밖에 나지 않습니다!`,now);return;}
    if(g12!=null&&g23!=null&&g12<.40&&g23<.40){commentaryLine(`three-${p1.index}-${p2.index}-${p3.index}`,`상위 3명이 한 덩어리입니다. ${p1.name}, ${p2.name}, ${p3.name}! 한 번의 회피가 순위를 바꿀 수 있습니다.`,now);return;}
    let climber=null,bestGain=0;ordered.forEach((q,i)=>{const gain=(q.match?.startRank||i+1)-(i+1);if(gain>bestGain){bestGain=gain;climber=q;}});
    if(climber&&bestGain>=3){commentaryLine(`climb-${climber.index}-${bestGain}`,`${climber.name}, 출발 순위보다 ${bestGain}계단 올라왔습니다. 추월 흐름이 좋습니다!`,now);return;}
    if(now-commentaryLastGeneralAt>5200){
      commentaryLastGeneralAt=now;
      if(frac<.22)commentaryLine(`phase1-${p1.index}`,`${p1.name}이 초반 선두를 잡았습니다. 첫 코너와 옵저버 회피가 중요합니다.`,now);
      else if(frac<.55)commentaryLine(`phase2-${p1.index}`,`${p1.name}이 선두, ${p2.name}이 추격합니다. 중반부터 라인 선택 하나가 추월 기회로 이어집니다.`,now);
      else if(frac<.82)commentaryLine(`phase3-${p1.index}`,`후반으로 들어갑니다. ${p1.name}이 앞서지만 ${p2.name}도 아직 사정권입니다. 실수 한 번이면 뒤집힙니다.`,now);
      else commentaryLine(`phase4-${p1.index}`,`마지막 구간! ${p1.name}이 선두를 지킵니다. 최단 라인과 마지막 회피가 승부를 결정합니다.`,now);
    }
  }

  function liveOrderedPlayers(){
    return [...players].sort((a,b)=>{
      if(a.done&&b.done) return a.finishTime-b.finishTime;
      if(a.done) return -1;if(b.done) return 1;
      return currentProgress(b)-currentProgress(a);
    });
  }
  function broadcastGapSeconds(a,b){
    if(!a||!b) return null;
    return Math.max(0,currentProgress(a)-currentProgress(b))/Math.max(1,(a.speed+b.speed)*.5);
  }
  function setBroadcastStory(key,kicker,title,sub,now=performance.now(),hold=1800){
    const k={"NEW LEADER":"선두 교체","FINAL BATTLE":"결승선 승부","3-WAY BATTLE":"3인 접전","BIG COMEBACK":"대역전","LEADER WATCH":"선두 수성","PHOTO FINISH":"포토피니시"}[kicker]||kicker;
    commentaryLine(`story-${key}`,`${k}! ${title}${sub?` · ${sub}`:""}`,now);
  }
  function updateBroadcastFinal(now){
    const ordered=liveOrderedPlayers();if(!ordered.length)return;
    const p1=ordered[0],p2=ordered[1],p3=ordered[2],frac=Math.max(0,Math.min(1,currentProgress(p1)/routeLength));
    const g12=broadcastGapSeconds(p1,p2),g23=broadcastGapSeconds(p2,p3);
    const strip=document.getElementById("broadcastStrip");
    if(strip)strip.innerHTML=`<div><span>${frac>=.82?"마지막 구간":"실시간 선두"}</span><b>${p1.name}</b></div><div><span>1위 ↔ 2위 격차</span><b>${g12==null?"--":g12.toFixed(2)+"초"}</b></div><div><span>2위 ↔ 3위 격차</span><b>${g23==null?"--":g23.toFixed(2)+"초"}</b></div><div><span>선두 교체</span><b>${raceLeaderChanges}회</b></div>`;
    updateLiveCommentary(now);
  }

  function updateCamera(dt){
    let leader=null, leaderProg=-Infinity;
    let second=null, secondProg=-Infinity;

    for(let i=0;i<players.length;i++){
      const p=players[i];
      if(p.done) continue;
      const prog=currentProgress(p);
      if(prog>leaderProg){
        second=leader; secondProg=leaderProg;
        leader=p; leaderProg=prog;
      }else if(prog>secondProg){
        second=p; secondProg=prog;
      }
    }
    if(!leader) return;

    const now=performance.now();

    // v2.06 broadcast rule: stay on P1 almost all the time.
    // A prior leader is only retained very briefly to avoid camera jitter during
    // near-identical overlaps/rapid timing swaps.
    if(cameraLeaderId!==leader.index){
      const held=players[cameraLeaderId];
      if(held && !held.done && now<cameraLeaderHoldUntil){
        const heldProg=currentProgress(held);
        if(leaderProg-heldProg<0.55){
          leader=held;
          leaderProg=heldProg;
        }else{
          cameraLeaderId=leader.index;
          cameraLeaderHoldUntil=now+650;
        }
      }else{
        cameraLeaderId=leader.index;
        cameraLeaderHoldUntil=now+650;
      }
    }

    let tx=leader.x, ty=leader.y;

    // Only include P2 subtly when the lead battle is genuinely close.
    if(second && Math.abs(leaderProg-secondProg)<0.85){
      tx=leader.x*.94+second.x*.06;
      ty=leader.y*.94+second.y*.06;
    }

    // Overtake/battle events remain on the HUD, but no longer pull the camera
    // away from the leader. This prevents constant broadcast cuts.
    const a=Math.min(0.068,dt*0.00220);
    camX+=(tx-camX)*a;
    camY+=(ty-camY)*a;
  }

  function finalizeRound(){
    if(roundTransitioning) return;
    roundTransitioning=true;

    const ordered=[...players].sort((a,b)=>a.finishTime-b.finishTime);
    const result={round:currentRound,team:{A:0,B:0},
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
        rankGain:Math.max(0,(p.match.startRank||8)-(p.match.bestRank||8)),
        trace:(p.match.trace||[]).slice(),
        bestSector:p.sectorTimes&&p.sectorTimes.length?Math.min(...p.sectorTimes):null,
        raceForm:p.raceForm,
        startReactionMs:p.startReactionMs,
        startExecution:p.startExecution,
        rating:0
      });
    });

    for(const x of result.players){
      x.rating=roundPerformanceRating(x);
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
      const startRank=(players[x.index].match?.startRank)||8;
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
      tournamentHighlights.push({round:currentRound,type:"CLEAN",text:`CLEAN RACE · ${clean.name} · 무충돌 ${clean.rank}위`});
    }

    roundHistory.push(result);
    recordLiveBalanceRound(result);
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
      publishMasterResult();
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

  function qaRuntimeStatus(){
    const issues=[];
    if(observers.length!==OBSERVER_COUNT) issues.push(`OBS ${observers.length}/${OBSERVER_COUNT}`);
    if(players.length!==8) issues.push(`P ${players.length}/8`);
    if(CAMERA_ZOOM!==3.0) issues.push(`CAM ${CAMERA_ZOOM}`);
    if(PLAYER_HIT_RADIUS!==0.36) issues.push(`HIT ${PLAYER_HIT_RADIUS}`);
    if(Math.abs(SIM_STEP_MS-20)>.001) issues.push(`SIM ${SIM_STEP_MS.toFixed(1)}`);
    if(STUN_MS!==2300) issues.push(`STUN ${STUN_MS}`);
    if(INV_MS!==1000) issues.push(`INV ${INV_MS}`);
    if(Math.abs(ROAD_MARGIN-.90)>.0001) issues.push(`ROAD ${ROAD_MARGIN}`);
    return issues.length?`QA CHECK ${issues.join("·")}`:"QA PASS · MASTER";
  }

  function renderDiagnostics(){
    const el=document.getElementById("diagnostics");
    if(!el || el.classList.contains("hidden")) return;
    let collisions=0,finishes=0,totalTime=0;
    for(const p of players){collisions+=p.match.collisions||0;if(p.done&&p.finishTime!=null){finishes++;totalTime+=p.finishTime;}}
    const avg=finishes?formatTime(totalTime/finishes):"--";
    el.innerHTML=`<b>RACE DIAGNOSTICS</b><br>FPS ${diagFps.toFixed(0)} · frame ${diagFrameMs.toFixed(1)}ms · max ${diagMaxFrameMs.toFixed(1)}ms<br>OBS ${observers.length} · collisions ${collisions} · overtakes ${raceTotalOvertakes}<br>leader changes ${raceLeaderChanges} · finishes ${finishes}/8 · avg ${avg}`;
  }

  const SIM_STEP_MS = 1000/50;
  const MAX_SIM_STEPS = 2;
  let simClock=0;
  let simTickCounter=0;
  let simAccumulator=0;


  function captureReplayFrame(now){
    if(!raceStart || now-replayLastCapture<100) return; // 10 fps replay data
    replayLastCapture=now;
    if(replayFrames.length>=1200) return;
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
      rctx.fillStyle=p.team==="A"?"#ff4d4d":"#4d8dff";
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
    setReplayCursor(replayCursor+dt*replaySpeed);
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
        ? markers.map((h,i)=>`<button class="highlight-jump" data-hi="${i}"><b>${h.type.replace("_"," ")}</b><span>${h.text}</span></button>`).join("")
        : `<span class="highlight-empty">자동 감지 하이라이트 없음</span>`;
      hl.querySelectorAll("[data-hi]").forEach(b=>{
        const h=markers[Number(b.dataset.hi)];
        b.addEventListener("click",()=>{
          replayFocusId=h.playerId??-1;
          replaySpeed=h.type==="PHOTO_FINISH"?.5:1;
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
    if(slow) replaySpeed=.5;
    setReplayCursor(seekMs==null?0:seekMs);
    panel.classList.remove("hidden");
  }

  function simulateStep(now,dt){
    updateObservers(now,dt);
    simTickCounter++;

    // v2.07: deterministic 10Hz observer lookup/prediction refresh.
    // Explicit ticks avoid duplicate refreshes caused by timestamp rounding.
    if(simTickCounter>=5){
      simTickCounter=0;
      rebuildObserverGrid();
      precomputeObserverPredictions();
    }

    for(let i=0;i<players.length;i++) updatePlayer(players[i],now,dt);
    updateCamera(dt);
    captureReplayFrame(now);
  }

  function loop(ts){
    if(!running) return;

    let frameDelta=ts-lastTs;
    lastTs=ts;
    diagFrameMs=frameDelta; diagMaxFrameMs=Math.max(diagMaxFrameMs,frameDelta); diagFrames++;
    if(!diagLastFpsTs) diagLastFpsTs=ts;
    if(ts-diagLastFpsTs>=1000){diagFps=diagFrames*1000/(ts-diagLastFpsTs);diagFrames=0;diagLastFpsTs=ts;}
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

    if(ts-lastRankingRender>=320){
      const rankingDt=ts-lastRankingRender;
      updateMatchRanks(rankingDt,simClock||ts);
      updateSectors(ts);
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
      const unitName=currentRound===1?"SCOURGE":currentRound===2?"SCOUT":"WRAITH";
      cameraLabel.textContent=`${BUILD_ID} · ${unitName} · OBS ${observers.length} · 화면 ${lastVisibleObs} · 300% · ${qaRuntimeStatus()}`;
      renderDiagnostics();
      updateBroadcastFinal(ts);
      lastRankingRender=ts;
    }

    if(players.every(p=>p.done)){
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
    let sx=camX-viewW/2, sy=camY-viewH/2;
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

    ctx.beginPath();
    for(let vi=0;vi<visibleObserverRender.length;vi++){
      const o=visibleObserverRender[vi];
      const x=(o.x-view.sx)*view.scale;
      const y=(o.y-view.sy)*view.scale;
      ctx.moveTo(x+r*1.20,y);
      ctx.ellipse(x,y,r*1.20,r*.72,0,0,Math.PI*2);
    }
    ctx.fillStyle="#d6e8ff";
    ctx.fill();
    ctx.strokeStyle="#5f89ad";
    ctx.lineWidth=lineW;
    ctx.stroke();

    ctx.beginPath();
    for(let vi=0;vi<visibleObserverRender.length;vi++){
      const o=visibleObserverRender[vi];
      const x=(o.x-view.sx)*view.scale;
      const y=(o.y-view.sy)*view.scale;
      ctx.moveTo(x+r*.50,y);
      ctx.arc(x+r*.20,y,r*.30,0,Math.PI*2);
    }
    ctx.fillStyle="#83bcdf";
    ctx.fill();

    return visibleObserverRender.length;
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
      const grayLeft=Math.max(0,(p.hitGrayUntil||p.stunUntil)-now);
      if(grayLeft>0){
        // v2.44: observer contact makes the UNIT itself unmistakably gray for the full stun.
        // Nickname/rank/team UI stays in its normal colors.
        ctx.filter="grayscale(100%) saturate(0%) brightness(60%) contrast(112%)";
        ctx.shadowColor="rgba(95,95,95,.72)";
      }else{
        ctx.filter="none";
        ctx.shadowColor=p.team==="A" ? "rgba(255,77,77,.45)" : "rgba(77,141,255,.45)";
      }
      ctx.shadowBlur=Math.max(3,r*.28);
      ctx.drawImage(sprite,-size/2,-size/2,size,size);
      ctx.filter="none";
      ctx.restore();
    }else{
      const grayMix=((p.hitGrayUntil||p.stunUntil)>now)?1:0;
      if(grayMix>0){
        const base=p.team==="A"?[255,77,77]:[77,141,255], g=82;
        const rr=Math.round(base[0]*(1-grayMix)+g*grayMix),gg=Math.round(base[1]*(1-grayMix)+g*grayMix),bb=Math.round(base[2]*(1-grayMix)+g*grayMix);
        ctx.fillStyle=`rgb(${rr},${gg},${bb})`;
      }else ctx.fillStyle=p.team==="A" ? "#ff4d4d" : "#4d8dff";
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

    // v2.07: cull + batch all visible observers into a few canvas paths.
    // This sharply reduces per-observer draw calls while preserving their look.
    const visibleObs=drawObservers(view);

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

  function recordSeasonResults(){if(seasonRecorded||roundHistory.length<3)return;const season=loadSeason();for(const round of roundHistory)for(const x of round.players){const s=season[x.name]||blankSeasonRow();s.starts++;s.totalRank+=x.rank;s.finishes++;if(x.rank===1)s.wins++;if(x.rank<=3)s.top3++;s.totalTime+=x.time||0;s.bestTime=s.bestTime==null?x.time:Math.min(s.bestTime,x.time);s.collisions+=x.collisions||0;if(!x.collisions)s.cleanRaces++;s.avoids+=x.avoids||0;s.overtakes+=x.overtakes||0;s.leadMs+=x.leadMs||0;s.distance+=x.distance||0;s.nearMisses+=x.nearMisses||0;s.extremeNearMisses+=x.extremeNearMisses||0;s.dangerExposureMs+=x.dangerExposureMs||0;s.totalRating+=x.rating||0;season[x.name]=s;}saveSeason(season);seasonRecorded=true;renderEloRanking();}

  function eloMetrics(s){const n=Math.max(1,s.starts||0),avgRank=(s.totalRank||0)/n,rankPower=(8-avgRank)/7,winRate=(s.wins||0)/n,top3Rate=(s.top3||0)/n,avgRating=(s.totalRating||0)/n,avoid=(s.avoids||0)/Math.max(1,(s.avoids||0)+(s.collisions||0)),nm=Math.min(1,(s.nearMisses||0)/(n*8)),ov=Math.min(1,(s.overtakes||0)/(n*4)),clean=(s.cleanRaces||0)/n,lead=Math.min(1,(s.leadMs||0)/(n*18000));const power=rankPower*.55+(winRate*.55+top3Rate*.45)*.14+Math.max(0,Math.min(1,(avgRating-4)/6))*.09+(avoid*.68+nm*.32)*.09+ov*.05+clean*.05+lead*.03;return{avgRank,winRate,top3Rate,avgRating,avoid,elo:Math.round(1000+power*1000)}}
  function renderEloRanking(){const box=document.getElementById("eloRankingList");if(!box)return;const s=loadSeason(),rows=names.map(name=>({name,s:s[name],m:eloMetrics(s[name])})).sort((a,b)=>b.m.elo-a.m.elo||a.m.avgRank-b.m.avgRank);box.innerHTML=rows.map((r,i)=>`<div class="elo-row"><div class="elo-rank">${i+1}</div><div class="elo-name"><b>${r.name}</b><small>${signatureMoves[drivingStyles[names.indexOf(r.name)].style].label}</small></div><div class="elo-score">${r.m.elo}</div><div class="elo-data">평균 ${r.s.starts?r.m.avgRank.toFixed(2):"--"}위 · ${r.s.starts}경기 · 승률 ${(r.m.winRate*100).toFixed(1)}% · Top3 ${(r.m.top3Rate*100).toFixed(1)}%<br>평점 ${r.s.starts?r.m.avgRating.toFixed(2):"--"} · 회피율 ${(r.m.avoid*100).toFixed(1)}% · NM ${r.s.nearMisses||0} · 충돌 ${r.s.collisions||0} · 추월 ${r.s.overtakes||0}</div></div>`).join("")}

  function resetSeason(){
    if(!confirm("v31 시즌 누적 기록을 전부 초기화할까요?")) return;
    localStorage.removeItem(SEASON_KEY);
    alert("시즌 기록을 초기화했습니다.");
  }

  function estimatedFinishSeconds(p,now=performance.now()){
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

  function addAutoHighlight(type,text,now=performance.now(),playerId=-1,importance=1){
    if(!raceStart) return;
    const t=Math.max(0,now-raceStart);
    const last=highlightMarkers[highlightMarkers.length-1];
    if(last && last.type===type && last.playerId===playerId && t-last.t<1200) return;
    highlightMarkers.push({type,text,t,playerId,importance});
    if(highlightMarkers.length>40) highlightMarkers.shift();
  }

  function pushRaceEvent(text,now=performance.now()){
    raceEventText=text;raceEventUntil=now+1600;
    const spoken=text.replace("OVERTAKE · ","추월! ").replace("NEW LEADER · ","새로운 선두! ").replace(/BEST SECTOR (\d+) · /,"최고 구간기록! ").replace("FINISH · ","결승선 통과! ");
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
          pushRaceEvent(`BEST SECTOR ${si+1} · ${p.name} ${formatTime(sectorMs)}`,now);
        }
      }
    }
  }

  function updateMatchRanks(dt,now=performance.now()){
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
        setBroadcastStory(`newlead-${ordered[0].index}-${raceLeaderChanges}`,"NEW LEADER",
          `${ordered[0].name} 선두 탈환`,oldLeader?`${oldLeader} 추월`:"",now,2200);
        addAutoHighlight("LEAD_CHANGE",`NEW LEADER · ${ordered[0].name}`,now,ordered[0].index,2);
      }
      lastLeaderName=ordered[0].name;
    }
  }


  let lastLiveStatsRender=0;
  function playerDangerStatus(p){const raw=nearbyObservers(p.x,p.y,13),s=segs[Math.min(p.seg,segs.length-1)];let front=0,close=0;for(const o of raw){const dx=o.x-p.x,dy=o.y-p.y;if(dx*dx+dy*dy<49)close++;if(dx*s.ux+dy*s.uy>0&&Math.abs(dx*s.nx+dy*s.ny)<4.2)front++;}const score=close+front*1.6;return score>=9?"극위험":score>=5?"위험":score>=2?"주의":"안전";}

  function livePerformanceRating(p,ordered,now=performance.now()){
    const rank=Math.max(1,ordered.indexOf(p)+1);
    const progress=Math.max(0,Math.min(1,currentProgress(p)/routeLength));
    const m=p.match||{};
    const avoidAttempts=Math.max(1,(m.avoids||0)+(m.collisions||0));
    const avoidRate=(m.avoids||0)/avoidAttempts;
    const controlRate=(m.controlAttempts||0)>0 ? (m.controlSuccesses||0)/(m.controlAttempts||1) : .72;
    const rankScore=(8-rank)/7;
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

  function renderLiveRatings(now=performance.now()){
    const box=document.getElementById("liveRatingList");
    if(!box)return;
    const ordered=liveOrderedPlayers();
    if(!ordered.length){box.innerHTML="";return;}
    // Keep ranking order for scanability, but score is independently calculated.
    box.innerHTML=ordered.map(p=>{
      const rating=livePerformanceRating(p,ordered,now);if(now-(p.lastRatingSampleAt||0)>=900){p.lastRatingSampleAt=now;p.liveRatingHistory.push(rating);if(p.liveRatingHistory.length>24)p.liveRatingHistory.shift();}const h=p.liveRatingHistory.length?p.liveRatingHistory:[rating];const pts=h.map((v,i)=>`${(h.length===1?117:i*117/(h.length-1)).toFixed(1)},${(20-Math.max(0,Math.min(1,(v-4)/6))*18).toFixed(1)}`).join(" ");return `<div class="live-rating-row"><span class="live-rating-name">${p.name}</span><svg class="rating-spark" viewBox="0 0 118 22"><line class="rating-baseline" x1="0" y1="20" x2="118" y2="20"/><polyline points="${pts}"/></svg><strong class="live-rating-value">${rating.toFixed(1)}</strong></div>`;
    }).join("");
  }

  function renderLiveStats(now=performance.now()){
    if(now-lastLiveStatsRender<950)return;
    lastLiveStatsRender=now;
    renderLiveRatings(now);
    const summary=document.getElementById("liveStatsSummary");
    const leaders=document.getElementById("liveStatsLeaders");
    const raceBox=document.getElementById("liveStatsRace");
    const playerBox=document.getElementById("liveStatsPlayers");
    const phase=document.getElementById("liveStatsPhase");
    if(!summary||!leaders||!raceBox||!playerBox)return;
    const ordered=liveOrderedPlayers();if(!ordered.length)return;
    const collisions=players.reduce((s,p)=>s+(p.match?.collisions||0),0);
    const overtakes=players.reduce((s,p)=>s+(p.match?.overtakes||0),0);
    const avoids=players.reduce((s,p)=>s+(p.match?.avoids||0),0);
    const controls=players.reduce((s,p)=>s+(p.match?.controlAttempts||0),0);
    const stops=players.reduce((s,p)=>s+(p.match?.stops||0),0);const nearMisses=players.reduce((s,p)=>s+(p.match?.nearMisses||0),0);
    const p1=ordered[0],p2=ordered[1];
    const gap=broadcastGapSeconds(p1,p2);
    const eta=estimatedFinishSeconds(p1,now);
    const bestPass=[...players].sort((a,b)=>(b.match?.overtakes||0)-(a.match?.overtakes||0))[0];
    const bestAvoid=[...players].sort((a,b)=>(b.match?.avoids||0)-(a.match?.avoids||0))[0];
    const bestLead=[...players].sort((a,b)=>(b.match?.leadMs||0)-(a.match?.leadMs||0))[0];
    const bestGain=[...players].sort((a,b)=>(b.match?.maxRankGain||0)-(a.match?.maxRankGain||0))[0];
    const prog=Math.max(0,Math.min(1,currentProgress(p1)/routeLength));
    if(phase)phase.textContent=`${currentRound}R · ${Math.round(prog*100)}%`;

    summary.innerHTML=`<div><span>충돌</span><b>${collisions}</b></div><div><span>추월</span><b>${overtakes}</b></div><div><span>회피</span><b>${avoids}</b></div><div><span>컨트롤</span><b>${controls}</b></div><div><span>스탑</span><b>${stops}</b></div><div><span>선두교체</span><b>${raceLeaderChanges}</b></div><div><span>NEAR MISS</span><b>${nearMisses}</b></div>`;

    const row=(label,p,val)=>`<div class="live-stat-leader"><span>${label}</span>${avatarHtml(p.index,"live-stat-avatar")}<b>${p.name}</b><strong>${val}</strong></div>`;
    leaders.innerHTML=row("추월",bestPass,bestPass.match?.overtakes||0)+
      row("회피",bestAvoid,bestAvoid.match?.avoids||0)+
      row("선두",bestLead,`${((bestLead.match?.leadMs||0)/1000).toFixed(1)}초`)+
      row("상승",bestGain,`+${bestGain.match?.maxRankGain||0}`);

    const dangerBox=document.getElementById("liveDanger");if(dangerBox)dangerBox.innerHTML=`<span>선두 주변 위험도</span><b>${playerDangerStatus(p1)}</b>`;
    raceBox.innerHTML=`<div><span>현재 선두</span><b>${p1.name}</b></div>
      <div><span>1↔2 격차</span><b>${gap==null?"--":gap.toFixed(2)+"초"}</b></div>
      <div><span>선두 예상기록</span><b>${eta==null?"--":eta.toFixed(2)+"초"}</b></div>
      <div><span>밀집구역</span><b>${observerDensityZones.length}곳</b></div>`;

    playerBox.innerHTML=ordered.slice(0,5).map((p,i)=>{
      const line=p.linePersonality>.45?"인코스":p.linePersonality<-.45?"안전/외곽":"균형";
      const creative=Math.min(55,Math.round((p.creativeRouteUsed||0)*100));
      return `<div class="live-player-stat"><span>${i+1}</span>${avatarHtml(p.index,"live-stat-avatar")}<b>${p.name}</b><small>${line}</small><em>${signatureOf(p).label} · NM ${p.match?.nearMisses||0} · 추월 ${p.match?.overtakes||0} · 충돌 ${p.match?.collisions||0}</em></div>`;
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

  function renderRanking(){
    const ordered=[...players].sort((a,b)=>{
      if(a.done && b.done) return a.finishTime-b.finishTime;
      if(a.done) return -1;if(b.done) return 1;
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
      frag.appendChild(c.row);
    }
    // Existing nodes are simply reordered; listeners/DOM nodes are reused.
    rankingEl.appendChild(frag);
    renderLiveStats();
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

  function identitySummary(p){
    const s=p.drivingStyle.style;
    if(s==="apexHunter") return "극인코스/공격적 코너 공략";
    if(s==="safeReader") return "안전거리/옵저버 예측 우선";
    if(s==="attacker") return "빠른 추월판단/빽컨 선호";
    if(s==="lineMaster") return "레이싱라인/코너 정밀도 우선";
    if(s==="controller") return "컨트롤 대응/스탑컨 선호";
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
        <div><b>당일 컨디션</b><span>${p.raceForm>=1.025?"좋음":p.raceForm<=.975?"흔들림":"보통"}</span></div>
        <div><b>팀전 누적점수</b><span>${playerTournament[p.index]?.total||0}점</span></div>
        <div><b>강점</b><span>${entries.slice(0,3).map(([k,v])=>`${statLabel(k)} ${v}`).join(" · ")}</span></div>
        <div><b>약점</b><span>${entries.slice(-3).reverse().map(([k,v])=>`${statLabel(k)} ${v}`).join(" · ")}</span></div>
      </div>
      <div class="statGrid">${Object.entries(p.stats).map(([k,v])=>`<div class="statCell"><span>${statLabel(k)}</span><b>${v}</b></div>`).join("")}</div>
      ${seasonCardHtml(p)}`;
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
      {label:"RACE MVP",name:mvp.name,value:`${mvp.points>0?"+":""}${mvp.points}점 · ${mvp.wins}승`},
      {label:"BEST OVERTAKER",name:pass.name,value:`추월 ${pass.overtakes}회`},
      {label:"CLEAN RACE",name:clean.name,value:`충돌 ${clean.collisions}회 · 평균 ${(clean.rankSum/clean.rounds).toFixed(1)}위`}
    ];
    if(sector) result.push({label:"BEST SECTOR",name:sector.name,value:formatTime(sector.bestSector)});
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
            passInside:0,passOutside:0,passWait:0,traces:[]};
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
      avgEfficiency:a.rounds?a.efficiency/a.rounds:0
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
      const rate=a.controls?`${a.controlRate.toFixed(0)}%`:"-";
      return `<tr>
        <td><div class="table-player">${avatarHtml(a.index,"table-avatar")}<button class="trace-player player-link" data-player="${a.index}">${a.name}</button></div></td>
        <td>${a.controls} / ${rate}</td>
        <td>${a.zigzag}</td><td>${a.backcon}</td><td>${a.stopcon}</td><td>${a.wide}</td>
        <td>${a.avgInside.toFixed(0)}%</td>
        <td>${a.avgExtreme.toFixed(0)}%</td>
        <td>${a.passInside}/${a.passOutside}/${a.passWait}</td>
        <td>${a.rankGain>0?`+${a.rankGain}`:"0"}</td>
        <td>${a.avgEfficiency.toFixed(1)}%</td>
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
    else if(top3>=2) strengths.push(`${top3}개 라운드 TOP3로 꾸준하게 상위권을 유지했다`);
    if(overtakes>=8) strengths.push(`총 ${overtakes}회 추월로 공격적인 레이스를 만들었다`);
    else if(overtakes>=4) strengths.push(`추월 ${overtakes}회로 순위 싸움에서 존재감을 보였다`);
    if(rankGain>=4) strengths.push(`한 라운드에서 최대 ${rankGain}계단을 끌어올리는 역전 능력을 보였다`);
    if(controlRate>=.90 && controls>=3) strengths.push(`컨트롤 성공률 ${(controlRate*100).toFixed(0)}%로 실행력이 안정적이었다`);
    if(collisions===0) strengths.push(`3라운드 동안 충돌 없이 완주했다`);
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

    const teamA=reports.filter(x=>x.team==="A");
    const teamB=reports.filter(x=>x.team==="B");
    const avg=(arr,key)=>arr.length?arr.reduce((s,x)=>s+x[key],0)/arr.length:0;
    const teamSummary={
      A:{rating:avg(teamA,"avgRating"),collisions:teamA.reduce((s,x)=>s+x.collisions,0),overtakes:teamA.reduce((s,x)=>s+x.overtakes,0)},
      B:{rating:avg(teamB,"avgRating"),collisions:teamB.reduce((s,x)=>s+x.collisions,0),overtakes:teamB.reduce((s,x)=>s+x.overtakes,0)}
    };

    const allLeaderChanges=roundHistory.reduce((s,r)=>s+(r.leaderChanges||0),0);
    const allOvertakes=roundHistory.reduce((s,r)=>s+(r.totalOvertakes||0),0);
    const winner=teamTotals.A===teamTotals.B?"무승부":teamTotals.A>teamTotals.B?"A":"B";
    let matchText;
    if(winner==="무승부"){
      matchText=`양 팀이 ${teamTotals.A}:${teamTotals.B}로 비겼다. 추월은 A ${teamSummary.A.overtakes}회, B ${teamSummary.B.overtakes}회였고 충돌은 A ${teamSummary.A.collisions}회, B ${teamSummary.B.collisions}회였다.`;
    }else{
      const loser=winner==="A"?"B":"A";
      matchText=`${winner}팀이 ${teamTotals[winner]}:${teamTotals[loser]}로 승리했다. ${winner}팀 평균 평점은 ${teamSummary[winner].rating.toFixed(1)}, ${loser}팀은 ${teamSummary[loser].rating.toFixed(1)}였다. 추월은 ${winner}팀 ${teamSummary[winner].overtakes}회, ${loser}팀 ${teamSummary[loser].overtakes}회였다.`;
    }

    matchText+=` 전체 3라운드 기준 선두교체 ${allLeaderChanges}회, 순위상승 ${allOvertakes}회를 기록했다.`;
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
            <small>평균 ${a.avgRank.toFixed(2)}위 · TOP3 ${a.top3}회 · 추월 ${a.overtakes} · 충돌 ${a.collisions} · 컨트롤 ${(a.controlRate*100).toFixed(0)}%</small>
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
    for(let rank=1;rank<=8;rank++){
      const y=T+(rank-1)*(h-T-B)/7;
      ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(w-R,y);ctx.stroke();
      ctx.fillText(`${rank}위`,L-10,y);
    }
    ctx.textAlign="center";ctx.textBaseline="top";
    for(let r=1;r<=3;r++){
      const x=L+(r-1)*(w-L-R)/2;
      ctx.fillText(`${r}R`,x,h-B+13);
    }

    for(let idx=0;idx<players.length;idx++){
      const pts=[];
      for(let r=1;r<=3;r++){
        const rd=roundHistory.find(q=>q.round===r);
        const x=rd?.players.find(q=>q.index===idx);
        if(x) pts.push({r,rank:x.rank});
      }
      if(!pts.length) continue;
      ctx.strokeStyle=colors[idx];ctx.fillStyle=colors[idx];ctx.lineWidth=3;
      ctx.beginPath();
      pts.forEach((p,i)=>{
        const x=L+(p.r-1)*(w-L-R)/2;
        const y=T+(p.rank-1)*(h-T-B)/7;
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      });
      ctx.stroke();
      pts.forEach(p=>{
        const x=L+(p.r-1)*(w-L-R)/2,y=T+(p.rank-1)*(h-T-B)/7;
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
    picks.innerHTML=[1,2,3].map(r=>`<button data-round="${r}">${r}R 경로</button>`).join("");
    picks.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>drawAllRoutes(Number(b.dataset.round))));
    drawRankChart();
    drawPerformanceChart();
    drawAllRoutes(roundHistory.length?roundHistory[roundHistory.length-1].round:3);
  }


  function showMatchResults(){
    const panel=document.getElementById("resultPanel");
    const body=document.getElementById("resultBody");
    const teamSummary=document.getElementById("teamResultSummary");

    const winner=teamTotals.A===teamTotals.B ? "무승부" : (teamTotals.A>teamTotals.B ? "A팀 승리" : "B팀 승리");
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
          <span>MATCH MVP</span>
          <b>${mvp?mvp.name:"-"}</b>
          <strong>${mvp?mvp.rating.toFixed(1):"-"}</strong>
          <small>${mvp?ratingGrade(mvp.rating):""}</small>
        </div>
        <div class="rating-grid">${ratings.map((a,i)=>`
          <div class="rating-card ${i===0?"mvp":""}">
            <div class="rating-player">${avatarHtml(a.index,"rating-avatar")}<span>${i+1}. ${a.name}</span></div>
            <b>${a.rating.toFixed(1)}</b>
            <small>${ratingGrade(a.rating)} · BEST ${a.best.toFixed(1)} · 추월 ${a.overtakes} · 충돌 ${a.collisions}</small>
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
        <span>${h.type.replace("_"," ")}</span><b>R${h.round} · ${h.text}</b>
      </button>`).join("") || `<div class="highlight-empty">자동 하이라이트가 없습니다.</div>`;
      autoEl.querySelectorAll(".auto-clip").forEach(b=>b.addEventListener("click",()=>{
        replayFocusId=Number(b.dataset.player);
        openReplay(Number(b.dataset.round),Math.max(0,Number(b.dataset.time)-1400),b.dataset.photo==="1");
      }));
    }
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
        <td><div class="table-player">${avatarHtml(names.indexOf(pt.name),"table-avatar")}<button class="result-name player-link" data-player="${names.indexOf(pt.name)}">${pt.name}</button></div></td>
        <td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td>
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
    if(!confirm("v2.28 실전 밸런스 누적 데이터를 초기화할까요?")) return;
    localStorage.removeItem(LIVE_BALANCE_KEY);
    renderLiveBalance();
  }

  // v2.16: fast Monte-Carlo balance test.
  // This intentionally avoids canvas/DOM race rendering and approximates the live
  // race from the same fixed player stats/styles. It is a balance diagnostic, not
  // a replacement for the normal race simulation.
  function balancePlayerModel(p){
    const s=p.stats;
    return {
      pace:(s.pace*.34+s.acceleration*.16+s.cornering*.14+s.insideLine*.10+
            s.routeReading*.08+s.control*.06+s.consistency*.05+s.endurance*.04+s.luck*.03)/100,
      safety:(s.avoidance*.24+s.reaction*.16+s.prediction*.19+s.control*.12+
              s.stability*.10+s.riskControl*.10+s.focus*.09)/100,
      pass:(s.aggression*.22+s.pressure*.16+s.insideLine*.18+s.routeReading*.16+
            s.prediction*.14+s.control*.14)/100,
      control:(s.control*.28+s.reaction*.22+s.stability*.18+s.focus*.15+s.pressure*.17)/100
    };
  }

  function simulateBalanceRace(){
    const models=players.map(balancePlayerModel);
    const racers=players.map((p,i)=>{
      const m=models[i];
      const form=(Math.random()-.5)*.038;
      const start=((p.stats.start-85)/27)*.018+((p.stats.reaction-85)/27)*.010;
      const base=55.0 - (m.pace-.85)*25.0 - start + form*8.0;
      const controls=Math.max(0,Math.round(2.1+Math.random()*3.8+(1-m.safety)*3.0));
      let controlOK=0;
      for(let k=0;k<controls;k++){
        const chance=Math.max(.66,Math.min(.97,.70+m.control*.27));
        if(Math.random()<chance) controlOK++;
      }
      const collisions=(Math.random()<Math.max(.035,.19-m.safety*.15)?1:0) +
        (Math.random()<Math.max(.006,.055-m.safety*.045)?1:0);
      const avoids=Math.round(4+m.safety*5+Math.random()*4);
      const passPotential=Math.max(0,Math.round(1+m.pass*4+Math.random()*4));
      const controlLoss=(controls-controlOK)*.24;
      const collisionLoss=collisions*(1.75+Math.random()*.65);
      const riskSwing=(Math.random()-.5)*(1.25+m.pass*.8);
      const time=Math.max(42,base+controlLoss+collisionLoss+riskSwing);
      return {i,p,m,time,collisions,avoids,controls,controlOK,passPotential,rating:0};
    });

    racers.sort((a,b)=>a.time-b.time);
    let overtakes=0;
    racers.forEach((r,rank)=>{
      r.rank=rank+1;
      const startRank=r.i+1;
      const gain=Math.max(0,startRank-r.rank);
      r.overtakes=Math.max(gain,Math.min(7,r.passPotential+Math.floor(Math.random()*2)));
      const cr=r.controls?r.controlOK/r.controls:1;
      r.rating=Math.max(4,Math.min(10,
        6+(9-r.rank)*.19+Math.min(1.05,r.overtakes*.11)+(cr-.75)*.90-r.collisions*.42));
      overtakes+=r.overtakes;
    });
    const leaderChanges=Math.max(0,Math.min(10,Math.round(overtakes/4+(Math.random()*3-1))));
    return {racers,overtakes,leaderChanges,p1:racers[0].time,p8:racers[7].time};
  }

  function runBalanceTest(count){
    const started=performance.now();
    const agg=players.map(p=>({name:p.name,races:0,wins:0,top3:0,rankSum:0,timeSum:0,
      best:Infinity,worst:0,collisions:0,avoids:0,overtakes:0,controls:0,controlOK:0,ratingSum:0,upsets:0}));
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
        raceCollisions+=x.collisions;
      }
      const abilityOrder=players.map((p,i)=>({i,o:(p.stats.pace+p.stats.cornering+p.stats.insideLine+p.stats.routeReading+p.stats.avoidance+p.stats.control+p.stats.consistency+p.stats.focus)/8}))
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

    return {count,elapsed,agg,avgP1,avgP8,avgSpread,
      avgCollisions:totalCollisions/count,cleanRate:100*clean/count,
      avgOvertakes:totalOvertakes/count,avgLeaderChanges:totalLeaderChanges/count,
      upsetRate:100*upsetCount/count,warnings};
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
      <div><span>이변 발생률</span><b>${result.upsetRate.toFixed(1)}%</b></div>`;

    body.innerHTML=result.agg.map(a=>{
      const wr=100*a.wins/result.count,top3=100*a.top3/result.count;
      const cr=a.controls?100*a.controlOK/a.controls:0;
      return `<tr><td>${a.name}</td><td>${wr.toFixed(1)}%</td><td>${top3.toFixed(1)}%</td>
        <td>${(a.rankSum/a.races).toFixed(2)}</td><td>${(a.timeSum/a.races).toFixed(2)}s</td>
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
    replaySpeed=Number(b.dataset.replaySpeed)||1;
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

  window.ObserverFMRaceEngine={
    version:BUILD_ID,schema:"observer-fm-race-result@1",
    getRules:()=>clonePlain(engineCoreRules()),
    getLastResult:()=>lastMasterResult?clonePlain(lastMasterResult):null,
    getCurrentState:()=>({build:BUILD_ID,running,paused,currentRound,
      teamScores:{A:teamTotals.A,B:teamTotals.B},finished:players.filter(p=>p.done).length}),
    startCurrent:start,resetMatch:reset
  };

  map.addEventListener("load",reset);
  if(map.complete) reset();
})();
