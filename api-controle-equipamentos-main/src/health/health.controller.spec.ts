import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('getHealth deve retornar status ok com timestamp', () => {
    const controller = new HealthController();
    const result = controller.getHealth();
    expect(result.status).toBe('ok');
    expect(typeof result.timestamp).toBe('string');
  });
});
