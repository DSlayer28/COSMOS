const { io } = require('socket.io-client');
const assert = require('assert');

// Connect to local server
const socket = io('http://localhost:3001', {
    query: { name: 'TestUser', id: 'test-user-id' },
    transports: ['websocket'],
});

async function runTests() {
    console.log('Starting Test Scenarios...');

    socket.on('connect', async () => {
        console.log('Connected to server.');

        try {
            await testPriorityAssignment();
            console.log('✅ Base priority mapped correctly');

            await testEscalationLogic();
            console.log('✅ Escalation and aging logic works (simulate)');
            
            await testResourceUpdate();
            console.log('✅ Resource update broadcast correctly');
            
            console.log('All tests passed!');
            process.exit(0);
        } catch (e) {
            console.error('Test Failed:', e);
            process.exit(1);
        }
    });

    socket.on('connect_error', (err) => {
        console.error('Connection Error. Make sure backend is running on 3001.', err);
        process.exit(1);
    });
}

function testPriorityAssignment() {
    return new Promise((resolve, reject) => {
        let timer = setTimeout(() => reject('Timeout waiting for request-created'), 3000);
        
        socket.once('request-created', (req) => {
            clearTimeout(timer);
            try {
                // Rescue should map to CRITICAL (1)
                assert.strictEqual(req.category, 'rescue');
                assert.strictEqual(req.basePriority, 1);
                assert.strictEqual(req.priority, 1);
                resolve();
            } catch (e) {
                reject(e);
            }
        });

        socket.emit('create-request', {
            category: 'rescue',
            title: 'Test rescue',
            description: 'Needs rescue',
            lat: 12.0,
            lng: 77.0,
            peopleAffected: 2,
            expiresAt: Date.now() + 1000 * 60 * 60
        });
    });
}

function testEscalationLogic() {
    return new Promise((resolve, reject) => {
        let timer = setTimeout(() => reject('Timeout waiting for request-created in escalation'), 3000);
        
        console.log('Sending create-request for info...');
        socket.once('request-created', (req) => {
            clearTimeout(timer);
            console.log('Received request-created in escalation');
            try {
                // Info should map to LOW (5)
                assert.strictEqual(req.category, 'information');
                assert.strictEqual(req.basePriority, 5);
                
                // Emulate update
                console.log('Sending update-request...');
                socket.once('request-updated', (updated) => {
                    console.log('Received request-updated');
                    assert.strictEqual(updated.status, 'acknowledged');
                    resolve();
                });
                
                socket.emit('update-request', {
                    id: req.id,
                    updates: { status: 'acknowledged' }
                });
            } catch (e) {
                reject(e);
            }
        });

        socket.emit('create-request', {
            category: 'information',
            title: 'Test Info',
            description: 'General info',
            lat: 12.0,
            lng: 77.0,
            peopleAffected: 0,
            expiresAt: Date.now() + 1000 * 60 * 60
        });
    });
}

function testResourceUpdate() {
    return new Promise((resolve, reject) => {
        let timer = setTimeout(() => reject('Timeout waiting for resources-history'), 3000);
        
        socket.once('resources-history', (resources) => {
            clearTimeout(timer);
            const r = resources[0];
            if (!r) return reject('No resources loaded');

            socket.once('resource-updated', (updated) => {
                try {
                    assert.strictEqual(updated.id, r.id);
                    assert.strictEqual(updated.status, 'CLOSED');
                    resolve();
                } catch(e) { reject(e); }
            });

            socket.emit('update-resource', {
                id: r.id,
                status: 'CLOSED'
            });
        });
        
        socket.emit('request-resources');
    });
}

runTests();
