/**
 * Editor Controller
 * Handles configuration requests for the prompt editor frontend.
 */
class EditorController {
  /**
   * Get editor configuration
   */
  async getConfig(req, res) {
    try {
      // DEBUG: Log the environment variable value as seen by the server
      console.log(`🔍 DEBUG [EditorConfig]: LLM_PROVIDER is set to: ${process.env.LLM_PROVIDER}`);

      const getEditorModelName = () => {
        const provider = process.env.LLM_PROVIDER || 'openai';
        switch (provider) {
          case 'openrouter':
            return process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
          case 'groq':
            return process.env.GROQ_MODEL || 'llama3-70b-8192';
          case 'openai':
          default:
            return process.env.OPENAI_MODEL || 'gpt-4-turbo';
        }
      };

      const modelName = getEditorModelName();
      console.log(`🔍 DEBUG [EditorConfig]: Determined editor model is: ${modelName}`);

      const config = {
        modelName: modelName,
      };
      res.json({ success: true, data: config });
    } catch (error) {
      console.error('Error fetching editor config:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch editor configuration.' });
    }
  }
}

module.exports = new EditorController();
