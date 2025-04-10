import React, { useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';
import { githubLight } from '@uiw/codemirror-theme-github';
import { Code2, Wand2 } from 'lucide-react';

function App() {
  const [sourceCode, setSourceCode] = useState<string>(`
@Service
public class UserService {
    private final UserRepository userRepository;
    
    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
    
    public User findById(Long id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("User not found"));
    }
    
    public List<User> findAll() {
        return userRepository.findAll();
    }
    
    public User save(User user) {
        return userRepository.save(user);
    }
}`.trim());
  const [generatedTests, setGeneratedTests] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const generateTests = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8080/api/test-generator/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: sourceCode,
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate tests');
      }
      
      const tests = await response.text();
      setGeneratedTests(tests);
    } catch (error) {
      console.error('Error generating tests:', error);
      setGeneratedTests('Error generating tests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Code2 className="h-8 w-8 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Spring Boot Test Generator</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Source Code</h2>
              <button
                onClick={generateTests}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                {loading ? 'Generating...' : 'Generate Tests'}
              </button>
            </div>
            <div className="border rounded-lg overflow-hidden bg-white">
              <CodeMirror
                value={sourceCode}
                height="600px"
                theme={githubLight}
                extensions={[java()]}
                onChange={(value) => setSourceCode(value)}
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Generated Tests</h2>
            <div className="border rounded-lg overflow-hidden bg-white">
              <CodeMirror
                value={generatedTests}
                height="600px"
                theme={githubLight}
                extensions={[java()]}
                editable={false}
                className="text-sm"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;