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
      console.log('🔍 DEBUG [EditorConfig]: Reading OPENAI_MODEL from .env. Value:', process.env.OPENAI_MODEL);

      const config = {
        modelName: process.env.OPENAI_MODEL || 'gpt-4-turbo',
      };
      res.json({ success: true, data: config });
    } catch (error) {
      console.error('Error fetching editor config:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch editor configuration.' });
    }
  }
}

module.exports = new EditorController();
