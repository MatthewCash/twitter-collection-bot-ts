import fs from 'fs/promises';
import { Tweet } from './types/Tweet';

let tweets: Tweet[];

export const loadTweets = async () => {
    const recordFile = await fs.readFile(process.env.TWEET_RECORD_PATH);
    tweets = JSON.parse(recordFile.toString());
};

export const getTweets = () => tweets;
