/**
 * Garante JWT_SECRET nos testes unitários (JwtModule/JwtStrategy) sem depender do .env local.
 */
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-only-jwt-secret-do-not-use-in-production';
