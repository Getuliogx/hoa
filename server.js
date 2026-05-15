import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { getHoroscope } from "horoscopefree";

const app = new Hono();

const aliases = {
  aries: "aries",
  touro: "taurus",
  gemeos: "gemini",
  cancer: "cancer",
  leao: "leo",
  virgem: "virgo",
  libra: "libra",
  escorpiao: "scorpio",
  sagitario: "sagittarius",
  capricornio: "capricorn",
  aquario: "aquarius",
  peixes: "pisces",

  taurus: "taurus",
  gemini: "gemini",
  leo: "leo",
  virgo: "virgo",
  scorpio: "scorpio",
  sagittarius: "sagittarius",
  capricorn: "capricorn",
  aquarius: "aquarius",
  pisces: "pisces"
};

const nomes = {
  aries: "Áries",
  taurus: "Touro",
  gemini: "Gêmeos",
  cancer: "Câncer",
  leo: "Leão",
  virgo: "Virgem",
  libra: "Libra",
  scorpio: "Escorpião",
  sagittarius: "Sagitário",
  capricorn: "Capricórnio",
  aquarius: "Aquário",
  pisces: "Peixes"
};

const emojis = {
  aries: "♈",
  taurus: "♉",
  gemini: "♊",
  cancer: "♋",
  leo: "♌",
  virgo: "♍",
  libra: "♎",
  scorpio: "♏",
  sagittarius: "♐",
  capricorn: "♑",
  aquarius: "♒",
  pisces: "♓"
};

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function dataBrasil() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo"
  }).format(new Date());
}

function limparTexto(texto) {
  return String(texto || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 430);
}

app.get("/", (c) => {
  return c.text("API do horóscopo online. Use /signo?signo=aries");
});

app.get("/signo", async (c) => {
  const recebido = normalizar(c.req.query("signo"));
  const signo = aliases[recebido];

  if (!recebido) {
    return c.text("Use assim: !signo aries | touro | gemeos | cancer | leao | virgem | libra | escorpiao | sagitario | capricornio | aquario | peixes");
  }

  if (!signo) {
    return c.text("Signo inválido. Use: aries, touro, gemeos, cancer, leao, virgem, libra, escorpiao, sagitario, capricornio, aquario ou peixes.");
  }

  try {
    const resultado = await getHoroscope(signo, dataBrasil(), "pt");
    const mensagem = limparTexto(resultado.text);

    if (!mensagem) {
      return c.text("Não consegui pegar o horóscopo agora. Tente novamente depois.");
    }

    return c.text(`${emojis[signo]} ${nomes[signo]} hoje: ${mensagem}`);
  } catch (erro) {
    return c.text("Não consegui pegar o horóscopo agora. Tente novamente depois.");
  }
});

const port = Number(process.env.PORT || 3000);

serve({
  fetch: app.fetch,
  port
});

console.log("Horóscopo rodando na porta " + port);