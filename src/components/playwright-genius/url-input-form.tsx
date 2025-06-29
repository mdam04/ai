"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, Link as LinkIcon, Loader2, Key } from "lucide-react";
import { useState, useEffect } from "react";

const formSchema = z.object({
  githubRepoUrl: z.string().url({ message: "Please enter a valid GitHub repository URL." }),
  applicationUrl: z.string().url({ message: "Please enter a valid application URL." }),
  githubToken: z.string().optional(),
});

export type UrlInputFormValues = z.infer<typeof formSchema>;

interface UrlInputFormProps {
  onSubmit: (values: UrlInputFormValues) => void;
  isLoading: boolean;
}

export default function UrlInputForm({ onSubmit, isLoading }: UrlInputFormProps) {
  const [githubToken, setGithubToken] = useState<string>('');

  const form = useForm<UrlInputFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      githubRepoUrl: "",
      applicationUrl: "",
      githubToken: "",
    },
  });

  useEffect(() => {
    const storedToken = localStorage.getItem('githubApiToken');
    if (storedToken) {
      setGithubToken(storedToken);
      form.setValue('githubToken', storedToken);
    }
  }, [form]);

  const handleTokenChange = (value: string) => {
    setGithubToken(value);
    if (value) {
      localStorage.setItem('githubApiToken', value);
    } else {
      localStorage.removeItem('githubApiToken');
    }
    form.setValue('githubToken', value);
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Analyze Application</CardTitle>
        <CardDescription>
          Enter the GitHub repository URL and the live application URL to begin analysis.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="githubRepoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <Github className="mr-2 h-5 w-5 text-primary" />
                    GitHub Repository URL
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="https://github.com/user/repo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="applicationUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <LinkIcon className="mr-2 h-5 w-5 text-primary" />
                    Application URL
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="https://yourapp.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="githubToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <Key className="mr-2 h-5 w-5 text-primary" />
                    GitHub API Token (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="password"
                      placeholder="Enter GitHub PAT for private repos / higher rate limits"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        handleTokenChange(e.target.value);
                      }}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Token is stored in your browser's local storage. Leave blank for public repositories (rate limits may apply).
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze Repository"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}