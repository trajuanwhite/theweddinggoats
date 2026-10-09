(function(){
'use strict';
function clean(value){return value.normalize('NFKD').replace(/\p{M}/gu,'').split(/[\s’-]+/).map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join('').replace(/[^\p{L}\p{N}]/gu,'');}
function generate(last,first,partner,year){
const n=clean(last),a=clean(first),b=clean(partner),y=/^\d{4}$/.test(year)?year:'';
if(!n||!/[\p{L}]/u.test(n))return [];
const wordplay={
white:['WhiteOnTime','WhiteWhereWeBelong','TheWhiteMove','WhitePlaceWhiteTime','TheWhiteTieAffair'],
wright:['WrightOnTime','TheWrightMove','WrightPlaceWrightTime','WrightWhereWeBelong'],
moore:['OneMooreReason','MooreThanARing','NoMooreMaybes','MooreOfUs','MooreAfterMidnight'],
king:['LongLiveTheKings','TheKingdomStartsHere','KingMe','ACoupleOfKings'],
knight:['TheKnightIsOurs','OneKnightOnly','KnightToRemember','OurKindOfKnight'],
day:['DayOneOfForever','OurDayHasCome','MadeMyDay','TheDayWeMadeItOfficial'],
long:['TheLongGame','LongStoryShortWeDo','InItForTheLongRun'],
young:['TheYoungAndTheWed','StayYoungTogether','YoungLoveGrownUp'],
hill:['ItsAllHillFromHere','OverTheHillIntoForever','TheHillsHaveVows'],
rose:['RoseToTheOccasion','TheFinalRose','ARoseByOurName'],
green:['GreenLightToForever','TheGrassIsGreenerHere','GreenMeansGo'],
brown:['TheBrownTakeover','BrownAndBound','TheBrownEdition'],
black:['BlackTieBlackName','TheBlackTieTakeover','BlackLabelLove'],
gray:['FiftyShadesOfMarried','GrayAreaNoMore','TheGraytestDay'],
grey:['GreyAreaNoMore','TheGreytestDay','FiftyShadesOfMarried'],
lee:['FinalLeeMarried','LoveAtFirstLee','OfficialLeeUs'],
li:['OfficialLiUs','FinalLiMarried'],
hall:['HallIn','HallOrNothing','TheHallOfForever'],
wood:['WoodYouMarryMe','KnockOnWoodWeDo','WoodYouLookAtUs'],
bell:['TheBellsAreRinging','SavedByTheWeddingBell','BellOfTheBall'],
baker:['BakedIntoForever','TheBakerAfterparty','BakerMade'],
cook:['LookWhosCooking','TheCooksAreBooked','CookedUpForever'],
price:['ThePriceIsRight','ThePriceIsForever','LoveBeyondPrice'],
chase:['TheChaseIsOver','WorthTheChase','ChaseClosed'],
stone:['SetInStone','StoneColdSmitten','TheStoneAgeOfUs'],
bond:['BondForLife','OurForeverBond','LicenseToWedBond'],
hart:['HartTaken','AllHart','HartAndSoul','TheHartWantsWhatItWants'],
heart:['HeartTaken','AllHeart','HeartAndSoul'],
fox:['TheFoxesMadeItOfficial','OutFoxedTheSingles','FoxyAndForever'],
parks:['ParksAndCelebration','OurForeverParkingSpot','ParksAfterDark'],
park:['ParkItWereMarried','ParkAfterDark','OurForeverParkingSpot'],
walker:['WalkerDownTheAisle','TheWalkersWalkTheWalk','WalkerIntoForever'],
reid:['ReidTheRoomWereMarried','ReidBetweenTheVows','ReidAllAboutIt'],
reed:['ReedBetweenTheVows','ReedTheRoomWereMarried','ReedAllAboutIt'],
write:['WriteOurNextChapter','WriteWhereWeBelong'],
page:['SamePageNewChapter','TurningThePage','ThePageTurner'],
booker:['BookedForLife','TheBookersAreBooked','BookerEverAfter'],
ford:['FordBetterOrWorse','FullSpeedFord','OurFordEver'],
cole:['ColeItLove','ColeMeYours','ColeAfterDark'],
coleman:['ColemanAndWife','TheColemanCommitment'],
hunt:['TheHuntIsOver','FoundOnTheHunt','HuntNoMore'],
fish:['TheCatchOfALifetime','TwoFishOneSea','OfficiallyOffTheHook'],
fisher:['TheFishersAreOffTheMarket','FisherFoundTheOne','CatchOfALifetime'],
snow:['SnowMoreWaiting','SnowPlaceLikeUs','LetItSnowLetUsWed'],
sweet:['TheSweetSpot','SweetDealSealed','SweetOnYou'],
love:['LoveMadeItOfficial','LoveIsTheLastName','SignedWithLove'],
best:['BestDecisionEver','SavedTheBestForUs','BestCaseScenario'],
west:['WestIsYetToCome','GoWestGetWed','WildWildWestWedding'],
banks:['BankingOnForever','TheBanksMerger','LoveInTheBank'],
burns:['TheBurnsAreOnFire','BurnsBright','SlowBurnsForever'],
sparks:['SparksMadeItOfficial','SparksAfterDark','LetTheSparksFly'],
may:['MayWeHaveThisDance','ComeWhatMayWeDo','MayBeForever'],
miles:['MilesAheadTogether','WorthEveryMile','MilesFromSingle'],
grant:['WishGranted','ForeverGranted','TheGrantFinale'],
royal:['TheRoyalAffair','RoyalTreatmentForTwo','RoyalByName'],
smith:['TheSmithsMadeItOfficial','SmithSignedAndSealed','TheSmithAfterparty'],
jones:['KeepingUpWithTheJoneses','JonesPartyOfTwo','TheJonesTakeover'],
johnson:['TheJohnsonJointVenture','TheJohnsonAfterparty','JohnsonSignedAndSealed'],
williams:['TheWilliamsTakeover','TheWilliamsAfterparty','WilliamsSignedAndSealed'],
davis:['DavisMadeItOfficial','TheDavisDebut','TheDavisAfterparty'],
miller:['ItsMillerTimeToWed','TheMillerMerger','MillerMadeItOfficial'],
taylor:['TaylorMadeForEachOther','TaylorMadeVows','TaylorMadeForTwo'],
porter:['PorterPartyOfTwo','ThePorterAfterparty','PorterMadeItOfficial'],
scott:['GreatScottWereMarried','ScottTheDate','ScottMadeItOfficial']
};
const specific=wordplay[n.toLowerCase()]||[];
const groups={Wordplay:[...specific],Modern:[`${n}MadeItOfficial`,`The${n}Afterparty`,`${n}SignedAndSealed`,`The${n}Takeover`,`${n}InGoodCompany`,`${n}NoPlusOneNeeded`,`${n}PlotTwist`,`The${n}MainEvent`],Understated:[`The${n}Chapter`,`HouseOf${n}`,`Simply${n}`,`${n}OnFilm`,`${n}InTheMaking`,`${n}Together`,`${n}FromHere`,`${n}AtLast`]};
// Only offer wordplay that fits this name; unfamiliar names get stronger neutral ideas.
if(!specific.length){const letter=n[0].toUpperCase();const alliteration={A:'AllIn',B:'BeyondTheVows',C:'ChapterOne',D:'DoneDeal',E:'Endgame',F:'ForKeeps',G:'GoingAllIn',H:'HereToStay',I:'InGoodCompany',J:'JustUs',K:'ForKeeps',L:'LockedIn',M:'MadeItOfficial',N:'NextChapter',O:'OnTheRecord',P:'PartyOfTwo',Q:'QuiteTheCouple',R:'RingAndRepeat',S:'SignedAndSealed',T:'TheTakeover',U:'UsFromHere',V:'VowsAndVictory',W:'WorthTheWait',Y:'YesToUs',Z:'ZeroDoubts'};if(alliteration[letter])groups.Modern.unshift(`${n}${alliteration[letter]}`);}
if(a&&b){groups.Modern.unshift(`${a}And${b}MadeItOfficial`,`${a}And${b}ForThePlot`);groups.Understated.unshift(`${a}And${b}OnFilm`,`${a}And${b}FromHere`);}
if(y){groups.Understated.unshift(`${n}${y}`,`The${n}Chapter${y}`);if(specific.length)groups.Wordplay.push(`${specific[0]}${y}`);}

const seen=new Set();return Object.entries(groups).flatMap(([style,items])=>items.filter(t=>!seen.has(t)&&(seen.add(t),true)).map(t=>({tag:'#'+t,style})));
}
if(typeof module!=='undefined')module.exports={clean,generate};
if(typeof document==='undefined')return;
const form=document.getElementById('generator'),results=document.getElementById('results'),cards=document.getElementById('cards'),status=document.getElementById('status');let ideas=[],style='All',page=0;
function render(){cards.replaceChildren();const pool=ideas.filter(x=>style==='All'||x.style===style);let chosen;if(!pool.length){const note=document.createElement('p');note.className='tip';note.textContent='No natural wordplay for this name yet. Try Modern or Understated for your shortlist.';cards.append(note);return;}if(style==='All'){const order=['Wordplay','Modern','Understated'];const ranked=order.flatMap(s=>pool.filter(x=>x.style===s));const offset=(page*8)%ranked.length;chosen=ranked.slice(offset,offset+8);if(chosen.length<8)chosen.push(...ranked.slice(0,8-chosen.length));}else chosen=Array.from({length:Math.min(8,pool.length)},(_,i)=>pool[(page*8+i)%pool.length]);
chosen.forEach(item=>{const card=document.createElement('article');card.className='hashtag';const content=document.createElement('div'),tag=document.createElement('strong'),category=document.createElement('small'),button=document.createElement('button');tag.textContent=item.tag;category.textContent=item.style;content.append(tag,category);button.type='button';button.className='copy';button.textContent='Copy';button.setAttribute('aria-label','Copy '+item.tag);button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(item.tag);status.textContent='Copied '+item.tag;button.textContent='Copied!';setTimeout(()=>button.textContent='Copy',1800);}catch{status.textContent='Select and copy your hashtag: '+item.tag;const range=document.createRange();range.selectNodeContents(tag);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);}});card.append(content,button);cards.append(card);});}
form.addEventListener('submit',event=>{event.preventDefault();ideas=generate(document.getElementById('lastName').value,document.getElementById('firstName').value,document.getElementById('partnerName').value,document.getElementById('year').value);if(!ideas.length){results.hidden=true;status.textContent='Enter a last name containing letters to get started.';return;}page=0;results.hidden=false;render();status.textContent='Your hashtags are ready.';results.scrollIntoView({behavior:'smooth',block:'start'});});
document.querySelectorAll('[data-style]').forEach(button=>button.addEventListener('click',()=>{style=button.dataset.style;page=0;document.querySelectorAll('[data-style]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();}));document.getElementById('more').addEventListener('click',()=>{page++;render();status.textContent='Here are more ideas for your name.';});
})();
