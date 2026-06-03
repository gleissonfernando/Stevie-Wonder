async function getJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Erro HTTP ${response.status} ao acessar ${url}`);
  }

  return response.json();
}

module.exports = {
  getJson
};
