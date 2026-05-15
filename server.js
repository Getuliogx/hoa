import http from "http";
import { URL } from "url";
import { getHoroscope, HoroscopeError } from "horoscopefree";

const PORT = process.env.PORT || 3000;

const signos = {
  aries: { key: "aries", nome: "Áries", emoji: "♈" },
  touro: { key: "taurus", nome: "Touro", emoji: "♉" },
  gemeos: { key: "gemini", nome: "Gêmeos", emoji: "♊" },
  cancer: { key: "cancer", nome: "Câncer", emoji: "♋" },
  leao: { key: "leo", nome: "Leão", emoji: "♌" },
  virgem: { key: "virgo", nome: "Virgem", emoji: "♍" },
  libra: { key: "libra", nome: "Libra", emoji: "♎" },
  escorpiao: { key: "scorpio", nome: "Escorpião", emoji: "♏" },
  sagitario: { key: "sagittarius", nome: "Sagitário", emoji: "♐" },
  capricornio: { key: "capricorn", nome: "Capricórnio", emoji: "♑" },
  aquario: { key: "aquarius", nome: "Aquário", emoji: "♒" },
  peixes: { key: "pisces", nome: "Peixes", emoji: "♓" }
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

function normalizar(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function dataBrasil() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function limparTexto(texto) {
  return String(texto || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function limitarChat(texto, limite = 485) {
  if (texto.length <= limite) return texto;
  const cortado = texto.slice(0, limite - 3);
  const ultimoPonto = Math.max(
    cortado.lastIndexOf("."),
    cortado.lastIndexOf("!"),
    cortado.lastIndexOf("?")
  );
  if (ultimoPonto > 250) return cortado.slice(0, ultimoPonto + 1);
  return cortado.trim() + "...";
}

function responder(res, status, texto) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });
  res.end(texto);
}

async function pegarHoroscopo(signoInterno, completo) {
  const info = signos[signoInterno];
  const hoje = dataBrasil();

  const resultado = await getHoroscope(info.key, hoje, "pt");
  const texto = limparTexto(resultado.text);

  if (!texto) {
    throw new Error("Texto vazio recebido da fonte.");
  }

  const resposta = `${info.emoji} ${info.nome} hoje: ${texto}`;

  // Twitch/StreamElements normalmente precisa caber em uma mensagem só.
  // Use /signo?signo=aries&full=1 no navegador para ver sem corte.
  return completo ? resposta : limitarChat(resposta);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/" || url.pathname === "/health") {
      return responder(res, 200, "API do horóscopo real online. Use /signo?signo=aries");
    }

    if (url.pathname === "/signo" || url.pathname === "/api/signo") {
      const recebidoOriginal = url.searchParams.get("signo") || "";
      const recebido = normalizar(recebidoOriginal);
      const signoInterno = aliases[recebido];
      const completo = ["1", "true", "sim", "full", "completo"].includes(
        normalizar(url.searchParams.get("full"))
      );

      if (!recebido) {
        return responder(res, 200, "Use assim: !signo aries | touro | gemeos | cancer | leao | virgem | libra | escorpiao | sagitario | capricornio | aquario | peixes");
      }

      if (!signoInterno) {
        return responder(res, 200, "Signo inválido. Use: aries, touro, gemeos, cancer, leao, virgem, libra, escorpiao, sagitario, capricornio, aquario ou peixes.");
      }

      const texto = await pegarHoroscopo(signoInterno, completo);
      return responder(res, 200, texto);
    }

    return responder(res, 404, "Not Found");
  } catch (erro) {
    console.error("ERRO:", erro);

    let detalhe = "fonte indisponível no momento";
    if (erro instanceof HoroscopeError && erro.code) {
      detalhe = erro.code;
    }

    return responder(res, 200, `Não consegui pegar o horóscopo real agora (${detalhe}). Tente novamente depois.`);
  }
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
