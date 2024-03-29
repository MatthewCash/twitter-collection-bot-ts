import fs from 'fs/promises';
import path from 'path';
import schedule from 'node-schedule';

import { Tweet } from './types/Tweet';
import { translateTextGoogle, translateTextMicrosoft } from './util/translate';
import { skipHashtags } from './util/hashtags';
import { findNextTweetFromPrevious, sendTweetToTwitter } from './twitter';
import { connectDatabase, saveLastTweetId } from './database';
import { loadTweets } from './tweetRecord';

export const startTweetScheduler = async () => {
    while (true) {
        const nextTweet = await findNextTweetFromPrevious();
        if (!nextTweet) return console.error('Could not determine next tweet!');

        const tweetDate = new Date(nextTweet.date.getTime() + 9.461e10);

        if (tweetDate.getTime() < Date.now()) {
            await new Promise(r => setTimeout(r, 5000)); // Help prevent rate limiting
            console.log(
                `Immediately publishing missed tweet scheduled for ${tweetDate.toUTCString()}`
            );
        } else {
            console.log(`Next tweet scheduled for ${tweetDate.toUTCString()}`);
            await new Promise(r => schedule.scheduleJob(tweetDate, r));
        }

        console.log(`Publishing tweet id: (${nextTweet.id})`);

        await publishTweet(nextTweet)
            .then(() => saveLastTweetId(nextTweet.id))
            .catch(error =>
                console.warn(
                    'An error occurred publishing tweet, will retry: ',
                    error
                )
            );
    }
};

const publishTweet = async (tweet: Tweet) => {
    const toTranslate = skipHashtags(tweet.content);

    let translatedText = await translateTextGoogle(toTranslate).catch(
        () => null
    );

    translatedText ||= await translateTextMicrosoft(toTranslate).catch(
        () => 'English Translation Unavailable'
    );

    const files = await Promise.all(
        tweet.fileNames.map(name =>
            fs.readFile(path.join(process.env.TWEET_COLLECTION_PATH, name))
        )
    );

    console.log(`Publishing tweet with ${files.length} images`);

    await sendTweetToTwitter(tweet, translatedText, files);
};

const main = async (...args) => {
    await Promise.all([
        connectDatabase().then(() => console.log('Database connected!')),
        loadTweets().then(() => console.log('Loaded tweet record!'))
    ]);

    await startTweetScheduler();
    process.exit(1); // If the scheduler exits, the service has failed
};;

main(...process.argv.slice(1));
