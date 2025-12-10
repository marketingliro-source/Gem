const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configuration de multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Générer un nom unique pour éviter les collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// Validation des types de fichiers
const fileFilter = (req, file, cb) => {
  // Types autorisés
  const allowedMimes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel' // .xls
  ];

  // Extensions dangereuses à bloquer
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.app', '.deb', '.rpm'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (dangerousExtensions.includes(fileExtension)) {
    return cb(new Error('Type de fichier non autorisé pour des raisons de sécurité'), false);
  }

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Types acceptés: PDF, Images (JPG, PNG, GIF), Documents Office (Word, Excel)'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // Limite à 10MB
  }
});

// Upload d'un document pour un client
router.post('/upload/:clientId', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const { clientId } = req.params;

    // Vérifier que le client existe (architecture multi-produits)
    const client = db.prepare('SELECT id FROM client_base WHERE id = ?').get(clientId);
    if (!client) {
      // Supprimer le fichier uploadé si le client n'existe pas
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Client introuvable' });
    }

    // Enregistrer le document dans la base de données (client_base_id)
    const result = db.prepare(`
      INSERT INTO client_documents (client_base_id, file_name, file_path, file_type, file_size, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      clientId,
      req.file.originalname,
      req.file.filename,
      req.file.mimetype,
      req.file.size,
      req.user.id
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      file_name: req.file.originalname,
      file_type: req.file.mimetype,
      file_size: req.file.size,
      uploaded_at: new Date().toISOString()
    });
  } catch (error) {
    // En cas d'erreur, supprimer le fichier uploadé
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

// Récupérer la liste des documents d'un client
router.get('/client/:clientId', authenticateToken, (req, res) => {
  try {
    const { clientId } = req.params;

    const documents = db.prepare(`
      SELECT
        client_documents.*,
        users.username as uploaded_by_username
      FROM client_documents
      LEFT JOIN users ON client_documents.uploaded_by = users.id
      WHERE client_base_id = ?
      ORDER BY uploaded_at DESC
    `).all(clientId);

    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Télécharger un document
router.get('/download/:documentId', authenticateToken, (req, res) => {
  try {
    const { documentId } = req.params;

    const document = db.prepare('SELECT * FROM client_documents WHERE id = ?').get(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document introuvable' });
    }

    const filePath = path.join(__dirname, '../../uploads', document.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier introuvable sur le serveur' });
    }

    res.download(filePath, document.file_name);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un document
router.delete('/:documentId', authenticateToken, (req, res) => {
  try {
    const { documentId } = req.params;
    console.log(`DELETE /documents/${documentId} - User: ${req.user?.username} (${req.user?.role})`);

    const document = db.prepare('SELECT * FROM client_documents WHERE id = ?').get(parseInt(documentId));
    if (!document) {
      console.log(`Document ${documentId} not found`);
      return res.status(404).json({ error: 'Document introuvable' });
    }

    console.log(`Document found: uploaded_by=${document.uploaded_by}, current_user=${req.user.id}`);

    // Seul l'uploadeur ou un admin peut supprimer
    if (document.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      console.log(`Permission denied: user ${req.user.id} cannot delete document uploaded by ${document.uploaded_by}`);
      return res.status(403).json({ error: 'Non autorisé - vous devez être l\'uploadeur ou admin' });
    }

    // Supprimer le fichier physique
    const filePath = path.join(__dirname, '../../uploads', document.file_path);
    console.log(`Deleting file: ${filePath}`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('File deleted successfully');
    } else {
      console.log('File not found on disk (already deleted?)');
    }

    // Supprimer l'entrée de la base de données
    db.prepare('DELETE FROM client_documents WHERE id = ?').run(parseInt(documentId));
    console.log(`Document ${documentId} deleted from database`);

    res.json({ message: 'Document supprimé' });
  } catch (error) {
    console.error(`Error deleting document:`, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
