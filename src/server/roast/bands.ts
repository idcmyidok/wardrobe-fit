import "server-only";
import type { Item } from "./analyze";

/**
 * 밴드 퀴즈(사용자 요청): 옷 이름이나 브랜드 칸에 밴드 이름이 있으면 "다음 중 {밴드}의 노래가 아닌 것은?"을 꼭 낸다.
 * - songs: 그 밴드의 유명한 곡 3개. wrong: 비슷한 장르·시대의 다른 밴드 곡(정답). wrongBy: 그 곡의 밴드.
 * - 흔한 단어 이름(Queen, Kiss, Blur 등)은 옷 이름에 밴드·투어·티셔츠 같은 말이 같이 있을 때만 밴드로 본다(ambiguous).
 * - 국내는 요즘 밴드만 넣는다(사용자 요청).
 * 정답이 확실한 곡만 쓴다. 새 밴드는 이 목록에 더한다.
 */
export interface Band {
  id: string;
  /** 문장에 쓰는 이름 */
  name: string;
  /** 옷 이름·브랜드에서 찾는 표기(영문은 단어 단위, 대소문자 무시) */
  aliases: string[];
  ambiguous?: boolean;
  songs: [string, string, string];
  wrong: string;
  wrongBy: string;
}

export const BANDS: Band[] = [
  // 해외
  { id: "metallica", name: "메탈리카", aliases: ["Metallica", "메탈리카"], songs: ["Enter Sandman", "Master of Puppets", "Nothing Else Matters"], wrong: "Paranoid", wrongBy: "Black Sabbath" },
  { id: "nirvana", name: "너바나", aliases: ["Nirvana", "너바나"], songs: ["Smells Like Teen Spirit", "Come as You Are", "Lithium"], wrong: "Black Hole Sun", wrongBy: "Soundgarden" },
  { id: "oasis", name: "오아시스", aliases: ["Oasis", "오아시스"], ambiguous: true, songs: ["Wonderwall", "Don't Look Back in Anger", "Champagne Supernova"], wrong: "Song 2", wrongBy: "Blur" },
  { id: "blur", name: "블러", aliases: ["Blur", "블러"], ambiguous: true, songs: ["Song 2", "Parklife", "Girls & Boys"], wrong: "Wonderwall", wrongBy: "Oasis" },
  { id: "radiohead", name: "라디오헤드", aliases: ["Radiohead", "라디오헤드"], songs: ["Creep", "Karma Police", "No Surprises"], wrong: "Yellow", wrongBy: "Coldplay" },
  { id: "coldplay", name: "콜드플레이", aliases: ["Coldplay", "콜드플레이"], songs: ["Yellow", "Viva la Vida", "The Scientist"], wrong: "Creep", wrongBy: "Radiohead" },
  { id: "beatles", name: "비틀즈", aliases: ["The Beatles", "Beatles", "비틀즈", "비틀스"], songs: ["Hey Jude", "Let It Be", "Yesterday"], wrong: "Paint It Black", wrongBy: "The Rolling Stones" },
  { id: "rollingstones", name: "롤링 스톤스", aliases: ["Rolling Stones", "롤링스톤즈", "롤링 스톤스", "롤링스톤스"], songs: ["Paint It Black", "(I Can't Get No) Satisfaction", "Gimme Shelter"], wrong: "Hey Jude", wrongBy: "The Beatles" },
  { id: "acdc", name: "AC/DC", aliases: ["AC/DC", "ACDC", "에이씨디씨"], songs: ["Highway to Hell", "Back in Black", "Thunderstruck"], wrong: "Sweet Child O' Mine", wrongBy: "Guns N' Roses" },
  { id: "gnr", name: "건즈 앤 로지스", aliases: ["Guns N' Roses", "Guns N Roses", "Guns and Roses", "건즈앤로지스", "건즈 앤 로지스"], songs: ["Sweet Child O' Mine", "Welcome to the Jungle", "November Rain"], wrong: "Highway to Hell", wrongBy: "AC/DC" },
  { id: "queen", name: "퀸", aliases: ["Queen", "퀸"], ambiguous: true, songs: ["Bohemian Rhapsody", "We Will Rock You", "Don't Stop Me Now"], wrong: "Stairway to Heaven", wrongBy: "Led Zeppelin" },
  { id: "ledzeppelin", name: "레드 제플린", aliases: ["Led Zeppelin", "레드 제플린", "레드제플린"], songs: ["Stairway to Heaven", "Whole Lotta Love", "Kashmir"], wrong: "Smoke on the Water", wrongBy: "Deep Purple" },
  { id: "pinkfloyd", name: "핑크 플로이드", aliases: ["Pink Floyd", "핑크 플로이드", "핑크플로이드"], songs: ["Another Brick in the Wall", "Wish You Were Here", "Comfortably Numb"], wrong: "Stairway to Heaven", wrongBy: "Led Zeppelin" },
  { id: "blacksabbath", name: "블랙 사바스", aliases: ["Black Sabbath", "블랙 사바스", "블랙사바스"], songs: ["Paranoid", "Iron Man", "War Pigs"], wrong: "Master of Puppets", wrongBy: "Metallica" },
  { id: "ironmaiden", name: "아이언 메이든", aliases: ["Iron Maiden", "아이언 메이든", "아이언메이든"], songs: ["The Trooper", "Run to the Hills", "Fear of the Dark"], wrong: "Ace of Spades", wrongBy: "Motörhead" },
  { id: "ramones", name: "라몬즈", aliases: ["Ramones", "라몬즈", "라몬스"], songs: ["Blitzkrieg Bop", "I Wanna Be Sedated", "Sheena Is a Punk Rocker"], wrong: "Anarchy in the U.K.", wrongBy: "Sex Pistols" },
  { id: "sexpistols", name: "섹스 피스톨즈", aliases: ["Sex Pistols", "섹스 피스톨즈", "섹스피스톨즈"], songs: ["Anarchy in the U.K.", "God Save the Queen", "Pretty Vacant"], wrong: "Blitzkrieg Bop", wrongBy: "Ramones" },
  { id: "smiths", name: "더 스미스", aliases: ["The Smiths", "더 스미스", "더스미스"], songs: ["There Is a Light That Never Goes Out", "This Charming Man", "How Soon Is Now?"], wrong: "Love Will Tear Us Apart", wrongBy: "Joy Division" },
  { id: "joydivision", name: "조이 디비전", aliases: ["Joy Division", "조이 디비전", "조이디비전"], songs: ["Love Will Tear Us Apart", "Disorder", "Transmission"], wrong: "This Charming Man", wrongBy: "The Smiths" },
  { id: "rhcp", name: "레드 핫 칠리 페퍼스", aliases: ["Red Hot Chili Peppers", "RHCP", "레드 핫 칠리 페퍼스", "레드핫칠리페퍼스"], songs: ["Californication", "Under the Bridge", "Can't Stop"], wrong: "Everlong", wrongBy: "Foo Fighters" },
  { id: "foofighters", name: "푸 파이터스", aliases: ["Foo Fighters", "푸 파이터스", "푸파이터스"], songs: ["Everlong", "The Pretender", "Learn to Fly"], wrong: "Californication", wrongBy: "Red Hot Chili Peppers" },
  { id: "greenday", name: "그린 데이", aliases: ["Green Day", "그린 데이", "그린데이"], songs: ["Basket Case", "American Idiot", "Boulevard of Broken Dreams"], wrong: "All the Small Things", wrongBy: "blink-182" },
  { id: "linkinpark", name: "린킨 파크", aliases: ["Linkin Park", "린킨 파크", "린킨파크"], songs: ["Numb", "In the End", "Crawling"], wrong: "Chop Suey!", wrongBy: "System of a Down" },
  { id: "arcticmonkeys", name: "악틱 몽키즈", aliases: ["Arctic Monkeys", "악틱 몽키즈", "악틱몽키즈"], songs: ["Do I Wanna Know?", "R U Mine?", "505"], wrong: "Mr. Brightside", wrongBy: "The Killers" },
  { id: "strokes", name: "스트록스", aliases: ["The Strokes", "스트록스", "더 스트록스"], songs: ["Last Nite", "Reptilia", "Someday"], wrong: "Mr. Brightside", wrongBy: "The Killers" },
  { id: "slipknot", name: "슬립낫", aliases: ["Slipknot", "슬립낫"], songs: ["Duality", "Psychosocial", "Wait and Bleed"], wrong: "Chop Suey!", wrongBy: "System of a Down" },
  { id: "cure", name: "더 큐어", aliases: ["The Cure", "더 큐어"], ambiguous: true, songs: ["Just Like Heaven", "Boys Don't Cry", "Friday I'm in Love"], wrong: "Love Will Tear Us Apart", wrongBy: "Joy Division" },
  { id: "kiss", name: "키스", aliases: ["Kiss", "키스"], ambiguous: true, songs: ["Rock and Roll All Nite", "Detroit Rock City", "I Was Made for Lovin' You"], wrong: "Highway to Hell", wrongBy: "AC/DC" },
  { id: "pearljam", name: "펄 잼", aliases: ["Pearl Jam", "펄 잼", "펄잼"], songs: ["Alive", "Even Flow", "Jeremy"], wrong: "Black Hole Sun", wrongBy: "Soundgarden" },
  { id: "ratm", name: "레이지 어게인스트 더 머신", aliases: ["Rage Against the Machine", "RATM", "레이지 어게인스트 더 머신"], songs: ["Killing in the Name", "Bulls on Parade", "Guerrilla Radio"], wrong: "Freak on a Leash", wrongBy: "Korn" },
  { id: "mcr", name: "마이 케미컬 로맨스", aliases: ["My Chemical Romance", "마이 케미컬 로맨스", "마이케미컬로맨스"], songs: ["Welcome to the Black Parade", "Helena", "Teenagers"], wrong: "Numb", wrongBy: "Linkin Park" },
  // 국내(요즘 밴드)
  { id: "jannabi", name: "잔나비", aliases: ["잔나비", "JANNABI"], songs: ["주저하는 연인들을 위해", "뜨거운 여름밤은 가고 남은 건 볼품없지만", "가을밤에 든 생각"], wrong: "위잉위잉", wrongBy: "혁오" },
  { id: "hanroro", name: "한로로", aliases: ["한로로", "HANRORO"], songs: ["입춘", "비틀비틀 짝짜꿍", "0+0"], wrong: "한 페이지가 될 수 있게", wrongBy: "DAY6" },
  { id: "silicagel", name: "실리카겔", aliases: ["실리카겔", "Silica Gel"], songs: ["NO PAIN", "Tik Tak Tok", "Desert Eagle"], wrong: "TOMBOY", wrongBy: "혁오" },
  { id: "hyukoh", name: "혁오", aliases: ["혁오", "HYUKOH"], songs: ["위잉위잉", "TOMBOY", "와리가리"], wrong: "NO PAIN", wrongBy: "실리카겔" },
  { id: "sesoneon", name: "새소년", aliases: ["새소년", "SE SO NEON", "SESONEON"], songs: ["난춘", "긴 꿈", "파도"], wrong: "주저하는 연인들을 위해", wrongBy: "잔나비" },
  { id: "day6", name: "DAY6", aliases: ["DAY6", "데이식스"], songs: ["예뻤어", "한 페이지가 될 수 있게", "행복했던 날들이었다"], wrong: "위잉위잉", wrongBy: "혁오" },
  { id: "lucy", name: "LUCY", aliases: ["LUCY", "루시"], ambiguous: true, songs: ["개화", "아지랑이", "조깅"], wrong: "예뻤어", wrongBy: "DAY6" },
  { id: "blackskirts", name: "검정치마", aliases: ["검정치마", "The Black Skirts", "Black Skirts"], ambiguous: true, songs: ["EVERYTHING", "기다린 만큼, 더", "Antifreeze"], wrong: "난춘", wrongBy: "새소년" },
  { id: "wavetoearth", name: "wave to earth", aliases: ["wave to earth", "웨이브 투 어스", "웨이브투어스"], songs: ["seasons", "bad", "love."], wrong: "EVERYTHING", wrongBy: "검정치마" },
  { id: "qwer", name: "QWER", aliases: ["QWER", "큐더블유이알"], songs: ["고민중독", "내 이름 맑음", "디스코드"], wrong: "개화", wrongBy: "LUCY" },
  { id: "glencheck", name: "글렌체크", aliases: ["글렌체크", "Glen Check"], ambiguous: true, songs: ["Vogue Boys And Girls", "Pacific", "Dreamreader"], wrong: "Tik Tak Tok", wrongBy: "실리카겔" },
];

/** 흔한 단어 이름의 밴드는 이 말이 같이 있어야 밴드로 본다. */
const BAND_CONTEXT = /밴드|band|투어|tour|머치|merch|앨범|album|콘서트|concert|티셔츠|tee|t-shirt|bootleg|부틀렉/i;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** 영문 별칭은 단어 단위로(예: "Kiss"가 "Kissing"에 걸리지 않게), 한글은 그대로 찾는다. */
const MATCHERS = BANDS.map((b) => ({
  band: b,
  re: new RegExp(b.aliases.map((a) => (/[a-z]/i.test(a) ? `(?<![a-z0-9])${esc(a)}(?![a-z0-9])` : esc(a))).join("|"), "i"),
}));

export function bandOf(i: Item): Band | null {
  const text = `${i.g.productName} ${i.g.brand}`;
  for (const { band, re } of MATCHERS) {
    if (!re.test(text)) continue;
    // 흔한 단어 이름: 브랜드 칸이 그 이름 그대로(밴드 굿즈 브랜드)이거나, 옷 이름에 밴드 관련 말이 있을 때만
    if (band.ambiguous && !re.test(i.g.brand) && !BAND_CONTEXT.test(i.g.productName)) continue;
    return band;
  }
  return null;
}

/** 옷장에서 처음 찾은 밴드와 그 밴드 옷 */
export function findBand(a: { items: Item[] }): { band: Band; items: Item[] } | null {
  const byBand = new Map<string, { band: Band; items: Item[] }>();
  for (const i of a.items) {
    const b = bandOf(i);
    if (!b) continue;
    const cur = byBand.get(b.id) ?? { band: b, items: [] };
    cur.items.push(i);
    byBand.set(b.id, cur);
  }
  // 옷이 가장 많은 밴드
  return [...byBand.values()].sort((x, y) => y.items.length - x.items.length)[0] ?? null;
}
