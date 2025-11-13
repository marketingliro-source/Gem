const Redis = require('ioredis');
const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');

/**
 * Service de cache et rate limiting avec Redis
 * Fallback en mémoire si Redis n'est pas disponible
 */
class CacheService {
  constructor() {
    this.redisClient = null;
    this.isRedisConnected = false;
    this.rateLimiters = {};
    this.memoryCache = new Map();
    this.init();
  }

  /**
   * Initialise la connexion Redis
   */
  init() {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => {
          // Reconnexion exponentielle avec max 3 secondes
          const delay = Math.min(times * 50, 3000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true
      };

      this.redisClient = new Redis(redisConfig);

      this.redisClient.on('connect', () => {
        console.log('✅ Redis connecté avec succès');
        this.isRedisConnected = true;
      });

      this.redisClient.on('error', (err) => {
        console.warn('⚠️  Redis error:', err.message);
        console.warn('📦 Utilisation du cache mémoire comme fallback');
        this.isRedisConnected = false;
      });

      this.redisClient.on('close', () => {
        console.warn('⚠️  Connexion Redis fermée');
        this.isRedisConnected = false;
      });

      // Tentative de connexion
      this.redisClient.connect().catch(err => {
        console.warn('⚠️  Impossible de se connecter à Redis:', err.message);
        console.warn('📦 Utilisation du cache mémoire uniquement');
        this.isRedisConnected = false;
      });

    } catch (error) {
      console.warn('⚠️  Redis non disponible:', error.message);
      console.warn('📦 Utilisation du cache mémoire uniquement');
      this.isRedisConnected = false;
    }
  }

  /**
   * Récupère un rate limiter pour une API spécifique
   * @param {string} apiName - Nom de l'API (sirene, dpe, bdnb, etc.)
   * @param {number} points - Nombre de requêtes autorisées
   * @param {number} duration - Durée en secondes
   */
  getRateLimiter(apiName, points = 30, duration = 1) {
    if (this.rateLimiters[apiName]) {
      return this.rateLimiters[apiName];
    }

    // Si Redis est disponible, utiliser RateLimiterRedis
    if (this.isRedisConnected && this.redisClient) {
      this.rateLimiters[apiName] = new RateLimiterRedis({
        storeClient: this.redisClient,
        keyPrefix: `rate_limit_${apiName}`,
        points: points, // Nombre de requêtes
        duration: duration, // Par seconde
      });
    } else {
      // Fallback en mémoire
      this.rateLimiters[apiName] = new RateLimiterMemory({
        keyPrefix: `rate_limit_${apiName}`,
        points: points,
        duration: duration,
      });
    }

    return this.rateLimiters[apiName];
  }

  /**
   * Attend avant de faire une requête (rate limiting)
   * @param {string} apiName - Nom de l'API
   * @param {string} key - Clé unique (ex: userId ou IP)
   */
  async waitForRateLimit(apiName, key = 'global') {
    const rateLimiter = this.rateLimiters[apiName];
    if (!rateLimiter) return;

    try {
      await rateLimiter.consume(key);
    } catch (rejRes) {
      // Si rate limit atteint, attendre
      const waitTime = Math.ceil(rejRes.msBeforeNext / 1000);
      console.log(`⏳ Rate limit ${apiName}: attente de ${waitTime}s`);
      await new Promise(resolve => setTimeout(resolve, rejRes.msBeforeNext));
      // Réessayer
      await rateLimiter.consume(key);
    }
  }

  /**
   * Récupère une valeur du cache
   * @param {string} key - Clé du cache
   * @returns {Promise<any|null>}
   */
  async get(key) {
    try {
      if (this.isRedisConnected && this.redisClient) {
        const value = await this.redisClient.get(key);
        return value ? JSON.parse(value) : null;
      } else {
        // Fallback mémoire
        const cached = this.memoryCache.get(key);
        if (cached && cached.expiry > Date.now()) {
          return cached.value;
        }
        this.memoryCache.delete(key);
        return null;
      }
    } catch (error) {
      console.error('Erreur cache.get:', error.message);
      return null;
    }
  }

  /**
   * Enregistre une valeur dans le cache
   * @param {string} key - Clé du cache
   * @param {any} value - Valeur à enregistrer
   * @param {number} ttl - Time to live en secondes (défaut: 3600 = 1h)
   */
  async set(key, value, ttl = null) {
    try {
      const cacheTTL = ttl || parseInt(process.env.CACHE_TTL) || 3600;

      if (this.isRedisConnected && this.redisClient) {
        await this.redisClient.setex(key, cacheTTL, JSON.stringify(value));
      } else {
        // Fallback mémoire
        this.memoryCache.set(key, {
          value,
          expiry: Date.now() + (cacheTTL * 1000)
        });

        // Nettoyage automatique des entrées expirées
        if (this.memoryCache.size > 1000) {
          this.cleanMemoryCache();
        }
      }
    } catch (error) {
      console.error('Erreur cache.set:', error.message);
    }
  }

  /**
   * Supprime une clé du cache
   * @param {string} key - Clé à supprimer
   */
  async delete(key) {
    try {
      if (this.isRedisConnected && this.redisClient) {
        await this.redisClient.del(key);
      } else {
        this.memoryCache.delete(key);
      }
    } catch (error) {
      console.error('Erreur cache.delete:', error.message);
    }
  }

  /**
   * Supprime toutes les clés correspondant à un pattern
   * @param {string} pattern - Pattern (ex: 'sirene:*')
   */
  async deletePattern(pattern) {
    try {
      if (this.isRedisConnected && this.redisClient) {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } else {
        // Fallback mémoire: supprimer les clés qui matchent
        for (const key of this.memoryCache.keys()) {
          if (this.matchPattern(key, pattern)) {
            this.memoryCache.delete(key);
          }
        }
      }
    } catch (error) {
      console.error('Erreur cache.deletePattern:', error.message);
    }
  }

  /**
   * Nettoie le cache mémoire des entrées expirées
   */
  cleanMemoryCache() {
    const now = Date.now();
    for (const [key, data] of this.memoryCache.entries()) {
      if (data.expiry <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Vérifie si une clé correspond à un pattern simple
   * @param {string} key - Clé à tester
   * @param {string} pattern - Pattern avec wildcards (*)
   */
  matchPattern(key, pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  }

  /**
   * Wrapper pour exécuter une fonction avec cache
   * @param {string} cacheKey - Clé du cache
   * @param {Function} fn - Fonction à exécuter si pas de cache
   * @param {number} ttl - TTL en secondes
   */
  async getOrSet(cacheKey, fn, ttl = null) {
    // Vérifier le cache
    const cached = await this.get(cacheKey);
    if (cached !== null) {
      console.log(`📦 Cache HIT: ${cacheKey}`);
      return cached;
    }

    // Exécuter la fonction
    console.log(`🔄 Cache MISS: ${cacheKey}`);
    const result = await fn();

    // Enregistrer en cache
    await this.set(cacheKey, result, ttl);

    return result;
  }

  /**
   * Ferme les connexions proprement
   */
  async close() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    this.memoryCache.clear();
  }
}

// Instance singleton
const cacheService = new CacheService();

module.exports = cacheService;
