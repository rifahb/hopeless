import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface Question {
  id: number;
  title: string;
  description: string;
  timeLimit: number;
  createdAt: string;
}

interface QuestionListProps {
  onStartQuestion: (questionId: number) => Promise<void>;
}

export function QuestionList({ onStartQuestion }: QuestionListProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch("/api/questions");
        if (!response.ok) {
          throw new Error("Failed to fetch questions");
        }
        const data = await response.json();
        setQuestions(data);
      } catch (error) {
        console.error("Error fetching questions:", error);
        toast({
          title: "Error",
          description: "Failed to load questions",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, [toast]);

  const handleStartQuestion = async (questionId: number) => {
    try {
      await onStartQuestion(questionId);
    } catch (error) {
      console.error("Error starting question:", error);
      toast({
        title: "Error",
        description: "Failed to start question",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div>Loading questions...</div>;
  }

  if (questions.length === 0) {
    return <div>No questions available.</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {questions.map((question) => (
        <Card key={question.id}>
          <CardHeader>
            <CardTitle>{question.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">{question.description}</p>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">
                Time Limit: {question.timeLimit} minutes
              </span>
              <Button onClick={() => handleStartQuestion(question.id)}>
                Start Question
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 