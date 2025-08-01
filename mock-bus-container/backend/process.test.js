const request = require('supertest');
const app = require('./index');

describe('Process API', () => {
  let server;
  beforeAll((done) => {
    server = app.listen(4003, done);
  });
  afterAll((done) => {
    server.close(done);
  });

  let createdId;
  const testProcess = { name: 'TestProcess', description: 'desc' };

  it('POST /api/processes — create', async () => {
    const res = await request(server)
      .post('/api/processes')
      .send(testProcess)
      .expect(201);
    expect(res.body).toHaveProperty('_id');
    createdId = res.body._id;
  });

  it('GET /api/processes — list', async () => {
    const res = await request(server)
      .get('/api/processes')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('DELETE /api/processes/:id — delete', async () => {
    const res = await request(server)
      .delete(`/api/processes/${createdId}`)
      .expect(200);
    expect(res.body).toHaveProperty('success', true);
  });
}); 