const { GoogleGenerativeAI } = require("@google/generative-ai");
import { getReviewsByRestaurantId } from "@/src/lib/firebase/firestore.js";
import { getAuthenticatedAppForUser } from "@/src/lib/firebase/serverApp";
import { getFirestore } from "firebase/firestore";
// added for modified call to avoid [GoogleGenerativeAI Error]: Candidate was blocked due to SAFETY
import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";

export async function GeminiSummary({ restaurantId }) {
  const { firebaseServerApp } = await getAuthenticatedAppForUser();
  const reviews = await getReviewsByRestaurantId(
    getFirestore(firebaseServerApp),
    restaurantId
  );

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // modified call to avoid [GoogleGenerativeAI Error]: Candidate was blocked due to SAFETY
  // from https://ai.google.dev/gemini-api/docs/safety-settings#node.js
  // ORIGINAL LINE: const model = genAI.getGenerativeModel({ model: "gemini-pro"});
  const genAIsafety = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ];
  // categories from: https://ai.google.dev/gemini-api/docs/safety-settings#node.js
  // HARM_CATEGORY_HARASSMENT, HARM_CATEGORY_HATE_SPEECH, HARM_CATEGORY_SEXUALLY_EXPLICIT, HARM_CATEGORY_DANGEROUS_CONTENT, and HARM_CATEGORY_CIVIC_INTEGRITY
  
  const model = genAI.getGenerativeModel(
    { 
      model: "gemini-1.5-flash",
      safetySettings: genAIsafety
    }
  );

  const reviewSeparator = "@";
  
  const prompt = `
    Based on the following restaurant reviews, 
    where each review is separated by a '${reviewSeparator}' character, 
    create a one-sentence summary of what people think of the restaurant. 
    
    Here are the reviews: ${reviews.map(review => review.text).join(reviewSeparator)}
  `;
  
  // const prompt = "Write a story about a magic backpack.";

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return (
      <div className="restaurant__review_summary">
        <p>{text}</p>
        <p>✨ Summarized with Gemini</p>
      </div>
    );
  } catch (e) {
    console.error(e);
    if (e.message.includes("403 Forbidden")) {
      return (
        <p>
          This service account doesn't have permission to talk to Gemini via
          Vertex
        </p>
      );
    } else {
      return (
        <div className="restaurant__review_summary">
          <p>Error contacting Gemini</p>
          <p>{e.message}</p>
        </div>
      );
    }
  }
}

export function GeminiSummarySkeleton() {
  return (
    <div className="restaurant__review_summary">
      <p>✨ Summarizing reviews with Gemini...</p>
    </div>
  );
}
