const request = require('supertest');
const app = require('./index');

describe('Channel API', () => {
  let server;
  beforeAll((done) => {
    server = app.listen(4001, done);
  });
  afterAll((done) => {
    server.close(done);
  });

  let createdId;
  const testChannel = { name: 'TestChannel', description: 'desc' };

  it('POST /api/channels — create', async () => {
    const res = await request(server)
      .post('/api/channels')
      .send(testChannel)
      .expect(201);
    expect(res.body).toHaveProperty('_id');
    createdId = res.body._id;
  });

  it('GET /api/channels — list', async () => {
    const res = await request(server)
      .get('/api/channels')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('DELETE /api/channels/:id — delete', async () => {
    const res = await request(server)
      .delete(`/api/channels/${createdId}`)
      .expect(200);
    expect(res.body).toHaveProperty('success', true);
  });
}); 