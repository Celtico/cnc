// Substitut del runtime d'artifacts de claude.ai fora de la plataforma.
// - 'downloads': baixa el fitxer amb un <a download> normal.
// - 'db' / 'user': no disponibles → l'app fa servir localStorage (plantilles i projectes).
(function () {
  if (window.claude && window.claude.use) return;
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'fitxer';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
  window.claude = {
    async use(name) {
      return name === 'downloads' ? downloads : null;
    },
  };
})();
