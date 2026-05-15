import http from "http";
import { URL } from "url";

const PORT = process.env.PORT || 3000;

const signos = {
  aries: { nome: "Áries", emoji: "♈" },
  touro: { nome: "Touro", emoji: "♉" },
  gemeos: { nome: "Gêmeos", emoji: "♊" },
  cancer: { nome: "Câncer", emoji: "♋" },
  leao: { nome: "Leão", emoji: "♌" },
  virgem: { nome: "Virgem", emoji: "♍" },
  libra: { nome: "Libra", emoji: "♎" },
  escorpiao: { nome: "Escorpião", emoji: "♏" },
  sagitario: { nome: "Sagitário", emoji: "♐" },
  capricornio: { nome: "Capricórnio", emoji: "♑" },
  aquario: { nome: "Aquário", emoji: "♒" },
  peixes: { nome: "Peixes", emoji: "♓" }
};

const aliases = {
  aries: "aries", "áries": "aries",
  touro: "touro",
  gemeos: "gemeos", "gêmeos": "gemeos",
  cancer: "cancer", "câncer": "cancer",
  leao: "leao", "leão": "leao",
  virgem: "virgem",
  libra: "libra",
  escorpiao: "escorpiao", "escorpião": "escorpiao",
  sagitario: "sagitario", "sagitário": "sagitario",
  capricornio: "capricornio", "capricórnio": "capricornio",
  aquario: "aquario", "aquário": "aquario",
  peixes: "peixes"
};

const mensagens = [
  "o dia pede calma e foco. Evite responder no impulso e escolha bem suas palavras.",
  "uma oportunidade pode aparecer de um jeito simples. Preste atenção nos sinais e não adie o que precisa ser feito.",
  "sua energia favorece conversas importantes. Seja direto, mas não perca a paciência.",
  "hoje é bom para organizar pendências e cortar o que está te atrasando.",
  "o momento favorece decisões práticas. Menos promessa e mais atitude.",
  "algo pode sair diferente do planejado, mas isso pode abrir um caminho melhor.",
  "confie mais no seu instinto, mas confira os detalhes antes de agir.",
  "o dia favorece reconciliação, acordos e mensagens que estavam demorando para chegar.",
  "você pode receber uma resposta ou perceber algo que muda sua visão sobre uma situação.",
  "evite gastar energia com quem não soma. Foque no que te aproxima do seu objetivo.",
  "uma conversa pode trazer clareza. Não guarde tudo só para você.",
  "hoje combina com recomeços pequenos, mas importantes. Faça uma coisa de cada vez.",
  "sua sorte melhora quando você para de insistir no que já mostrou sinais de desgaste.",
  "o dia pede cuidado com ansiedade. Respire, observe e aja na hora certa.",
  "uma boa notícia pode vir através de alguém próximo ou de uma mensagem inesperada."
];

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

function hashTexto(texto) {
  let h = 0;
  for (let i = 0; i < texto.length; i++) {
    h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return h;
}

function responder(res, status, texto) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });
  res.end(texto);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/" || url.pathname === "/health") {
    return responder(res, 200, "API do horóscopo online. Use /signo?signo=aries");
  }

  if (url.pathname === "/signo" || url.pathname === "/api/signo") {
    const recebidoOriginal = url.searchParams.get("signo") || "";
    const recebido = normalizar(recebidoOriginal);
    const signo = aliases[recebido];

    if (!recebido) {
      return responder(res, 200, "Use assim: !signo aries | touro | gemeos | cancer | leao | virgem | libra | escorpiao | sagitario | capricornio | aquario | peixes");
    }

    if (!signo) {
      return responder(res, 200, "Signo inválido. Use: aries, touro, gemeos, cancer, leao, virgem, libra, escorpiao, sagitario, capricornio, aquario ou peixes.");
    }

    const hoje = dataBrasil();
    const idx = hashTexto(`${hoje}-${signo}`) % mensagens.length;
    const info = signos[signo];

    return responder(res, 200, `${info.emoji} ${info.nome} hoje: ${mensagens[idx]}`);
  }

  return responder(res, 404, "Not Found");
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
