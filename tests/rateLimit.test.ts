import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('login rate limit', () => {
  it('allows 10 login attempts then blocks with 429', async () => {
    const payload = { email: 'nobody@example.com', password: 'Password123' };

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request(app).post('/api/auth/login').send(payload);
      expect(response.status).toBe(401);
    }

    const blocked = await request(app).post('/api/auth/login').send(payload);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.message).toMatch(/Too many login attempts/);
  });
});
