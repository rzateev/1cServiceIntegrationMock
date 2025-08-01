const request = require('supertest');
const app = require('./index');

describe('User API', () => {
  let server;
  beforeAll((done) => {
    server = app.listen(4002, done);
  });
  afterAll((done) => {
    server.close(done);
  });

  let createdId;
  const testUser = { username: 'TestUser', password: '12345' };

  it('POST /api/users — create', async () => {
    const res = await request(server)
      .post('/api/users')
      .send(testUser)
      .expect(201);
    expect(res.body).toHaveProperty('_id');
    createdId = res.body._id;
  });

  it('GET /api/users — list', async () => {
    const res = await request(server)
      .get('/api/users')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('DELETE /api/users/:id — delete', async () => {
    const res = await request(server)
      .delete(`/api/users/${createdId}`)
      .expect(200);
    expect(res.body).toHaveProperty('success', true);
  });
}); 