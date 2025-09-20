import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Bot, User } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function Assistant() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Array<{ id: number|string; type: "bot"|"user"; content: string; timestamp: string }>>([
    { id: 1, type: "bot", content: "Hi! I'm your MediGuide AI assistant. Ask me anything about your medications.", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  ]);

  useEffect(() => {
    (async () => {
      try {
        const history = await apiFetch<{ interactions: any[] }>("/assistant/interactions");
        if (Array.isArray(history.interactions)) {
          const formatted = history.interactions.slice(0, 20).reverse().flatMap((h, idx) => ([
            { id: `u-${idx}`, type: "user" as const, content: h.userMessage, timestamp: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
            { id: `b-${idx}`, type: "bot" as const, content: h.assistantResponse, timestamp: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
          ]));
          setMessages(prev => [prev[0], ...formatted]);
        }
      } catch {}
    })();
  }, []);

  const quickQuestions = [
    "What are the side effects of my medications?",
    "Can I take my medications together?",
    "What should I do if I miss a dose?",
    "Are there any food interactions?",
    "How should I store my medications?"
  ];

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    const userMsg = { id: `${Date.now()}-u`, type: "user" as const, content: message, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMsg]);
    const input = message;
    setMessage("");
    try {
      const res = await apiFetch<{ response: string }>("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ message: input, context: {} }),
      });
      const botMsg = { id: `${Date.now()}-b`, type: "bot" as const, content: res.response, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
      setMessages(prev => [...prev, botMsg]);
    } catch (e: any) {
      const botMsg = { id: `${Date.now()}-b`, type: "bot" as const, content: e?.message || 'Something went wrong.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
      setMessages(prev => [...prev, botMsg]);
    }
  };

  const handleQuickQuestion = (question: string) => {
    setMessage(question);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
        <p className="text-muted-foreground">
          Get personalized guidance about your medications
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Chat with AI Assistant
              </CardTitle>
              <CardDescription>
                Ask questions about your medications, side effects, and adherence
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto mb-4 p-4 border rounded-lg">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex gap-2 max-w-[80%] ${msg.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        msg.type === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                      }`}>
                        {msg.type === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      </div>
                      <div className={`p-3 rounded-lg ${
                        msg.type === 'user' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <p className="text-sm">{msg.content}</p>
                        <p className="text-xs opacity-70 mt-1">{msg.timestamp}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Ask about your medications..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button onClick={handleSendMessage}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Questions</CardTitle>
              <CardDescription>Common medication questions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="w-full text-left justify-start h-auto p-3"
                  onClick={() => handleQuickQuestion(question)}
                >
                  <span className="text-sm">{question}</span>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge className="w-full justify-center py-2">
                Drug Interaction Checker
              </Badge>
              <Badge className="w-full justify-center py-2" variant="secondary">
                Side Effect Monitor
              </Badge>
              <Badge className="w-full justify-center py-2" variant="outline">
                Adherence Tips
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}