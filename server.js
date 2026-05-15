import http from "http";
import { URL } from "url";

const PORT = process.env.PORT || 3000;

const signos = {
  aries: { api: "aries", nome: "Áries", emoji: "♈" },
  touro: { api: "taurus", nome: "Touro", emoji: "♉" },
  gemeos: { api: "gemini", nome: "Gêmeos", emoji: "♊" },
  cancer: { api: "cancer", nome: "Câncer", emoji: "♋" },
  leao: { api: "leo", nome: "Leão", emoji: "♌" },
  virgem: { api: "virgo", nome: "Virgem", emoji: "♍" },
  libra: { api: "libra", nome: "Libra", emoji: "♎" },
  escorpiao: { api: "scorpio", nome: "Escorpião", emoji: "♏" },
  sagitario: { api: "sagittarius", nome: "Sagitário", emoji: "♐" },
  capricornio: { api: "capricorn", nome: "Capricórnio", emoji: "♑" },
  aquario: { api: "aquarius", nome: "Aquário", emoji: "♒" },
  peixes: { api: "pisces", nome: "Peixes", emoji: "♓" }
};

const aliases = {
  aries: "aries", "áries": "aries",
  touro: "touro", taurus: "touro",
  gemeos: "gemeos", "gêmeos": "gemeos", gemini: "gemeos",
  cancer: "cancer", "câncer": "cancer",
  leao: "leao", "leão": "leao", leo: "leao",
  virgem: "virgem", virgo: "virgem",
  libra: "libra",
  escorpiao: "escorpiao", "escorpião": "escorpiao", scorpio: "escorpiao",
  sagitario: "sagitario", "sagitário": "sagitario", sagittarius: "sagitario",
  capricornio: "capricornio", "capricórnio": "capricornio", capricorn: "capricornio",
  aquario: "aquario", "aquário": "aquario", aquarius: "aquario",
  peixes: "peixes", pisces: "peixes"
};

const cache = new Map();

function normalizar(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function limparTexto(texto) {
  return String(texto || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function cortarParaChat(texto, limite = 480) {
  texto = limparTexto(texto);
  if (texto.length <= limite) return texto;

  const pedaço = texto.slice(0, limite - 3);
  const cortes = [pedaço.lastIndexOf("."), pedaço.lastIndexOf("!"), pedaço.lastIndexOf("?")];
  const melhor = Math.max(...cortes);

  if (melhor >= 260) return pedaço.slice(0, melhor + 1);
  return pedaço.trim() + "...";
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
      "User-Agent": "Mozilla/5.0 horoscopo-streamelements"
    }
  });

  const body = await r.text();

  if (!r.ok) {
    throw new Error(`HTTP ${r.status}: ${body.slice(0, 200)}`);
  }

  return JSON.parse(body);
}

async function traduzirPtBr(texto) {
  texto = limparTexto(texto);
  if (!texto) return "";

  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt-BR&dt=t&q=" +
    encodeURIComponent(texto);

  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 horoscopo-streamelements"
    }
  });

  const body = await r.text();

  if (!r.ok) {
    throw new Error(`TRADUCAO HTTP ${r.status}: ${body.slice(0, 200)}`);
  }

  const data = JSON.parse(body);
  return limparTexto(data?.[0]?.map(p => p?.[0] || "").join("") || texto);
}

async function pegarHoroscopo(signoInterno, periodo = "daily") {
  const info = signos[signoInterno];

  if (!["daily", "weekly", "monthly"].includes(periodo)) {
    periodo = "daily";
  }

  const cacheKey = `${periodo}:${signoInterno}:${new Date().toISOString().slice(0, 10)}`;
  const salvo = cache.get(cacheKey);
  if (salvo && Date.now() - salvo.ts < 1000 * 60 * 60 * 6) {
    return salvo.texto;
  }

  const url = `https://freehoroscopeapi.com/api/v1/get-horoscope/${periodo}?sign=${encodeURIComponent(info.api)}`;
  const json = await fetchJson(url);

  const original = limparTexto(json?.data?.horoscope || "");
  if (!original) {
    throw new Error("API respondeu sem texto de horóscopo.");
  }

  let traduzido = original;
  try {
    traduzido = await traduzirPtBr(original);
  } catch (e) {
    console.error("Falha ao traduzir; usando texto original:", e);
  }

  const texto = `${info.emoji} ${info.nome} hoje: ${traduzido}`;
  cache.set(cacheKey, { ts: Date.now(), texto });
  return texto;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/" || url.pathname === "/health") {
      return responder(res, 200, "API horóscopo online. Teste: /signo?signo=touro");
    }

    if (url.pathname === "/signo" || url.pathname === "/api/signo") {
      const recebido = normalizar(url.searchParams.get("signo") || "");
      const signoInterno = aliases[recebido];
      const completo = ["1", "true", "sim", "full", "completo"].includes(normalizar(url.searchParams.get("full")));
      const periodo = normalizar(url.searchParams.get("periodo") || "daily");

      if (!recebido) {
        return responder(res, 200, "Use assim: !signo aries | touro | gemeos | cancer | leao | virgem | libra | escorpiao | sagitario | capricornio | aquario | peixes");
      }

      if (!signoInterno) {
        return responder(res, 200, "Signo inválido. Use: aries, touro, gemeos, cancer, leao, virgem, libra, escorpiao, sagitario, capricornio, aquario ou peixes.");
      }

      const texto = await pegarHoroscopo(signoInterno, periodo);
      return responder(res, 200, completo ? texto : cortarParaChat(texto));
    }

    return responder(res, 404, "Not Found");
  } catch (erro) {
    console.error("ERRO:", erro);
    return responder(res, 200, "Não consegui pegar o horóscopo agora. A API externa falhou, tente novamente daqui a pouco.");
  }
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
