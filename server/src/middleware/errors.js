export const notFound = (req, res) => res.status(404).json({ message: 'Ressource introuvable.' });
export const errorHandler = (err, req, res, next) => {
  console.error(err); if (err.name === 'MulterError') return res.status(422).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'L’image ne peut pas dépasser 5 Mo.' : err.message }); if (err.name === 'ValidationError') return res.status(422).json({ message: err.message });
  if (err.code === 11000) return res.status(409).json({ message: 'Ce code ou cette valeur existe déjà. Veuillez en choisir un(e) autre.' });
  res.status(err.status || 500).json({ message: err.message || 'Erreur interne.' });
};
