import http from "http";
import { URL } from "url";

const PORT = process.env.PORT || 3000;

const signos = {
  aries: { api: "aries", nome: "Áries", emoji: "♈", aliases: ["aries", "áries"] },
  touro: { api: "taurus", nome: "Touro", emoji: "♉", aliases: ["touro", "taurus"] },
  gemeos: { api: "gemini", nome: "Gêmeos", emoji: "♊", aliases: ["gemeos", "gêmeos", "gemini"] },
  cancer: { api: "cancer", nome: "Câncer", emoji: "♋", aliases: ["cancer", "câncer"] },
  leao: { api: "leo", nome: "Leão", emoji: "♌", aliases: ["leao", "leão", "leo"] },
  virgem: { api: "virgo", nome: "Virgem", emoji: "♍", aliases: ["virgem", "virgo"] },
  libra: { api: "libra", nome: "Libra", emoji: "♎", aliases: ["libra"] },
  escorpiao: { api: "scorpio", nome: "Escorpião", emoji: "♏", aliases: ["escorpiao", "escorpião", "scorpio"] },
  sagitario: { api: "sagittarius", nome: "Sagitário", emoji: "♐", aliases: ["sagitario", "sagitário", "sagittarius"] },
  capricornio: { api: "capricorn", nome: "Capricórnio", emoji: "♑", aliases: ["capricornio", "capricórnio", "capricorn"] },
  aquario: { api: "aquarius", nome: "Aquário", emoji: "♒", aliases: ["aquario", "aquário", "aquarius"] },
  peixes: { api: "pisces", nome: "Peixes", emoji: "♓", aliases: ["peixes", "pisces"] }
};

function normalizar(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const aliases = {};
for (const [key, info] of Object.entries(signos)) {
  aliases[normalizar(key)] = key;
  for (const a of info.aliases) aliases[normalizar(a)] = key;
}

const cache = new Map();

function limparTexto(texto) {
  return String(texto || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function escaparRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removerRepeticaoDoSigno(texto, info) {
  let t = limparTexto(texto);

  const nomes = [...new Set([
    info.nome,
    normalizar(info.nome),
    info.api,
    ...info.aliases
  ].filter(Boolean))];

  for (let rodada = 0; rodada < 8; rodada++) {
    const antes = t;

    for (const nome of nomes) {
      const n = escaparRegex(nome);

      t = t.replace(new RegExp(`^\\s*hoje\\s*,?\\s*${n}\\s*,?\\s*[:\\-–—]?\\s*`, "i"), "");
      t = t.replace(new RegExp(`^\\s*${n}\\s*,?\\s*hoje\\s*,?\\s*[:\\-–—]?\\s*`, "i"), "");
      t = t.replace(new RegExp(`^\\s*para\\s+(o\\s+signo\\s+de\\s+)?${n}\\s*,?\\s*[:\\-–—]?\\s*`, "i"), "");
      t = t.replace(new RegExp(`^\\s*para\\s+${n}\\s*,?\\s*[:\\-–—]?\\s*`, "i"), "");
      t = t.replace(new RegExp(`^\\s*${n}\\s*,?\\s*[:\\-–—]?\\s*`, "i"), "");

      t = t.replace(new RegExp(`^\\s*today\\s*,?\\s*${n}\\s*,?\\s*[:\\-–—]?\\s*`, "i"), "");
      t = t.replace(new RegExp(`^\\s*for\\s+${n}\\s*,?\\s*[:\\-–—]?\\s*`, "i"), "");
    }

    t = t.replace(/^\s*hoje\s*,?\s*/i, "");
    t = t.replace(/^\s*para\s+hoje\s*,?\s*/i, "");
    t = t.replace(/^\s*today\s*,?\s*/i, "");
    t = limparTexto(t);

    if (t === antes) break;
  }

  if (t) t = t.charAt(0).toLowerCase() + t.slice(1);
  return t;
}

function cortarChat(texto, limite = 480) {
  texto = limparTexto(texto);
  if (texto.length <= limite) return texto;

  const pedaco = texto.slice(0, limite - 3);
  const cortes = [pedaco.lastIndexOf("."), pedaco.lastIndexOf("!"), pedaco.lastIndexOf("?"), pedaco.lastIndexOf(";")];
  const melhor = Math.max(...cortes);
  if (melhor >= 220) return pedaco.slice(0, melhor + 1);
  return pedaco.trim() + "...";
}

function responder(res, status, texto) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });
  res.end(texto);
}

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0"
    }
  });

  const body = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${body.slice(0, 200)}`);
  return JSON.parse(body);
}

async function traduzirPtBr(texto) {
  texto = limparTexto(texto);
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt-BR&dt=t&q=" +
    encodeURIComponent(texto);

  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const body = await r.text();
  if (!r.ok) throw new Error(`TRADUCAO HTTP ${r.status}: ${body.slice(0, 200)}`);

  const data = JSON.parse(body);
  return limparTexto(data?.[0]?.map(p => p?.[0] || "").join("") || texto);
}

async function pegar(signoKey) {
  const info = signos[signoKey];
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  const cacheKey = `${signoKey}:${hoje}`;
  const salvo = cache.get(cacheKey);
  if (salvo && Date.now() - salvo.ts < 1000 * 60 * 60 * 6) return salvo.texto;

  const apiUrl = `https://freehoroscopeapi.com/api/v1/get-horoscope/daily?sign=${encodeURIComponent(info.api)}`;
  const json = await fetchJson(apiUrl);

  const original = limparTexto(json?.data?.horoscope || "");
  if (!original) throw new Error("API sem horoscope");

  let pt = original;
  try {
    pt = await traduzirPtBr(original);
  } catch (e) {
    console.error("Tradução falhou, usando original:", e);
  }

  const limpo = removerRepeticaoDoSigno(pt, info);

  // FORMATO EXATO:
  // ♍ Virgem hoje: mensagem...
  const final = cortarChat(`${info.emoji} ${info.nome} hoje: ${limpo}`);

  cache.set(cacheKey, { ts: Date.now(), texto: final });
  return final;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/" || url.pathname === "/health") {
      return responder(res, 200, "Use /sigo?signo=virgem");
    }

    if (url.pathname === "/sigo" || url.pathname === "/signo") {
      const recebido = normalizar(url.searchParams.get("signo") || url.searchParams.get("sigo") || "");
      if (!recebido) return responder(res, 200, "Use assim: !sigo virgem");

      const signoKey = aliases[recebido];
      if (!signoKey) return responder(res, 200, "Signo inválido. Use: aries, touro, gemeos, cancer, leao, virgem, libra, escorpiao, sagitario, capricornio, aquario ou peixes.");

      return responder(res, 200, await pegar(signoKey));
    }

    return responder(res, 404, "Not Found");
  } catch (e) {
    console.error("ERRO:", e);
    return responder(res, 200, "Não consegui pegar o horóscopo agora. Tente novamente depois.");
  }
});

server.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
