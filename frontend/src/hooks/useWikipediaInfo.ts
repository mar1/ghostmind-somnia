"use client";

import { useState, useEffect } from "react";

export interface WikipediaInfo {
  title: string;
  extract: string;
  thumbnail?: string;
  pageUrl?: string;
}

export function useWikipediaInfo(name: string | undefined) {
  const [info, setInfo] = useState<WikipediaInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!name) {
      setInfo(null);
      return;
    }

    const fetchWikipediaInfo = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Wikipedia REST API for page summary
        const encodedName = encodeURIComponent(name.replace(/ /g, "_"));
        const response = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedName}`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          // Try with different casing or search
          const searchResponse = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedName.toLowerCase()}`,
            { headers: { Accept: "application/json" } }
          );

          if (!searchResponse.ok) {
            throw new Error("Wikipedia page not found");
          }

          const searchData = await searchResponse.json();
          setInfo({
            title: searchData.title,
            extract: searchData.extract || "No description available.",
            thumbnail: searchData.thumbnail?.source,
            pageUrl: searchData.content_urls?.desktop?.page,
          });
          return;
        }

        const data = await response.json();
        setInfo({
          title: data.title,
          extract: data.extract || "No description available.",
          thumbnail: data.thumbnail?.source,
          pageUrl: data.content_urls?.desktop?.page,
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch Wikipedia info"));
        setInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWikipediaInfo();
  }, [name]);

  return { info, isLoading, error };
}
