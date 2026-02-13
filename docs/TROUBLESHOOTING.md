# Troubleshooting Pearl

Common issues and solutions when running Pearl.

## Port Already in Use

**Symptom:** Pearl fails to start with error about port 8080 already in use.

**Cause:** Another service is using port 8080. Common culprits:
- `signal-cli` (Signal messaging daemon)
- Jenkins
- Tomcat
- Other local web servers

**Solution:**

### Option 1: Change Pearl's Port (Recommended)

1. Edit `pearl.yaml`:
```yaml
server:
  port: 8081  # Or 8082, 8083, etc.
  host: 127.0.0.1
```

2. Restart Pearl:
```bash
npm start
```

3. Update OpenClaw config if using OpenClaw integration:
```json
{
  "models": {
    "providers": {
      "pearl": {
        "baseUrl": "http://127.0.0.1:8081/v1"  // Updated port
      }
    }
  }
}
```

### Option 2: Stop Conflicting Service

If signal-cli is using port 8080:

```bash
# Find the process
lsof -i :8080 | grep LISTEN

# Kill it (example PID 12345)
kill 12345

# Or reconfigure signal-cli to use a different port
signal-cli daemon --http 127.0.0.1:8090
```

## Check What's Using a Port

```bash
# macOS/Linux
lsof -i :8080 | grep LISTEN

# Show process name and PID
lsof -i :8080 | grep LISTEN | awk '{print $1, $2}'

# Kill process by port (macOS/Linux)
lsof -ti :8080 | xargs kill
```

## Pearl Server Won't Start

**Check logs:**
```bash
npm start 2>&1 | tee pearl-startup.log
```

**Common issues:**

### Missing Dependencies
```bash
npm install
npm run build
```

### Missing Environment Variables
```bash
# Check if API keys are set
echo $ANTHROPIC_API_KEY
echo $OPENAI_API_KEY

# Set them if missing
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-proj-..."
```

### Missing Ollama
If using local Ollama models, ensure Ollama is running:
```bash
ollama list
ollama serve
```

## OpenClaw Can't Connect to Pearl

**Symptoms:**
- OpenClaw shows connection errors
- Requests timeout
- "Model not found" errors

**Solutions:**

1. **Verify Pearl is running:**
```bash
curl http://localhost:8081/health
# Should return: {"status":"healthy","pearl_initialized":true}
```

2. **Check port matches OpenClaw config:**
Compare `pearl.yaml` port with OpenClaw's `baseUrl`:
```bash
# Pearl port
grep "port:" pearl.yaml

# OpenClaw config
cat ~/.openclaw/openclaw.json | jq '.models.providers.pearl.baseUrl'
```

3. **Test Pearl API directly:**
```bash
curl -X POST http://localhost:8081/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "test"}]
  }'
```

## Routing Not Working as Expected

**Check routing decisions:**
Pearl includes routing metadata in responses. Look for the `pearl` field:

```bash
curl -X POST http://localhost:8081/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "test"}]
  }' | jq '.pearl'
```

**Expected output:**
```json
{
  "classification": {
    "complexity": "low",
    "type": "chat",
    "weightedScore": 0.054
  },
  "routing": {
    "selectedModel": "ollama/DeepSeek-R1:8b",
    "matchedRule": "short-to-ollama"
  }
}
```

**Tune routing rules:**
Edit `pearl.yaml` routing section to adjust priority, complexity thresholds, or add custom rules.

## Memory Extraction Not Working

**Check extraction config:**
```yaml
extraction:
  enabled: true
  model: ollama/DeepSeek-R1:8b  # Or another model
  async: true
```

**Verify extraction model is available:**
```bash
# For Ollama
ollama list | grep DeepSeek-R1

# Pull if missing
ollama pull DeepSeek-R1:8b
```

**Check memory database:**
```bash
sqlite3 ./pearl-data/memories.db "SELECT COUNT(*) FROM memories;"
```

## Performance Issues

**Symptoms:**
- Slow response times
- High classification overhead
- Memory leaks

**Solutions:**

1. **Use faster classification:**
```yaml
routing:
  classifier: heuristic  # Faster than weighted, less accurate
```

2. **Reduce memory retrieval:**
```yaml
retrieval:
  max_memories: 5  # Default is 10
  token_budget: 300  # Default is 500
```

3. **Disable memory extraction for speed:**
```yaml
extraction:
  enabled: false
```

4. **Check Ollama performance:**
```bash
ollama ps  # Show running models
ollama stop DeepSeek-R1:8b  # Stop unused models
```

## Debugging Tips

**Enable verbose logging:**
```yaml
logging:
  level: debug  # Options: error, warn, info, debug
  file: ./pearl-data/pearl.log
```

**Monitor logs in real-time:**
```bash
tail -f ./pearl-data/pearl.log
```

**Test individual components:**

1. **Test model backend:**
```bash
# Anthropic
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-5","messages":[{"role":"user","content":"test"}],"max_tokens":10}'

# Ollama
curl http://localhost:11434/api/generate \
  -d '{"model":"DeepSeek-R1:8b","prompt":"test","stream":false}'
```

2. **Test classification:**
```bash
# Send a query and check pearl.classification in response
curl -X POST http://localhost:8081/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Write a complex algorithm"}]
  }' | jq '.pearl.classification'
```

## Getting Help

If you're still stuck:

1. **Check existing issues:** [GitHub Issues](https://github.com/samhotchkiss/openclaw-pearl/issues)
2. **Create a new issue** with:
   - Pearl version (`git rev-parse HEAD`)
   - Error logs
   - `pearl.yaml` config (remove API keys!)
   - Steps to reproduce
3. **Include diagnostic info:**
```bash
# System info
uname -a
node --version
npm --version

# Pearl status
curl http://localhost:8081/health

# Port status
lsof -i :8081
```
