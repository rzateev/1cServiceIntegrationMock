const request = require('supertest');
const app = require('./index');

describe('Application API', () => {
  let server;
  beforeAll((done) => {
    server = app.listen(4000, done);
  });
  afterAll((done) => {
    server.close(done);
  });

  let createdId;
  const testApp = { name: 'TestApp', description: 'desc' };

  it('POST /api/applications — create', async () => {
    const res = await request(server)
      .post('/api/applications')
      .send(testApp)
      .expect(201);
    expect(res.body).toHaveProperty('_id');
    createdId = res.body._id;
  });

  it('GET /api/applications — list', async () => {
    const res = await request(server)
      .get('/api/applications')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('DELETE /api/applications/:id — delete', async () => {
    const res = await request(server)
      .delete(`/api/applications/${createdId}`)
      .expect(200);
    expect(res.body).toHaveProperty('success', true);
  });
}); 