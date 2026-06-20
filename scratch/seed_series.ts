import mongoose from 'mongoose';
import { Content } from '../src/app/modules/content/content.model';
import { Season } from '../src/app/modules/content/season.model';
import { Episode } from '../src/app/modules/content/episode.model';
import config from '../src/config';

const DEMO_VIDEOS = [
  'https://res.cloudinary.com/demo/video/upload/sea_turtle.mp4',
  'https://res.cloudinary.com/demo/video/upload/elephants.mp4',
  'https://res.cloudinary.com/demo/video/upload/dog.mp4',
  'https://res.cloudinary.com/demo/video/upload/kitten-playing.mp4',
  'https://res.cloudinary.com/demo/video/upload/snow_deer.mp4'
];

const SERIES_DATA = [
  {
    title: 'Stranger Things',
    description: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.',
    thumbnailUrl: 'https://picsum.photos/id/11/500/281',
    releaseYear: 2016,
    seasons: [
      {
        title: 'Season 1',
        posterUrl: 'https://picsum.photos/id/12/500/750',
        trailerUrl: DEMO_VIDEOS[0]
      },
      {
        title: 'Season 2',
        posterUrl: 'https://picsum.photos/id/13/500/750',
        trailerUrl: DEMO_VIDEOS[1]
      }
    ]
  },
  {
    title: 'Breaking Bad',
    description: 'A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family\'s future.',
    thumbnailUrl: 'https://picsum.photos/id/14/500/281',
    releaseYear: 2008,
    seasons: [
      {
        title: 'Season 1',
        posterUrl: 'https://picsum.photos/id/15/500/750',
        trailerUrl: DEMO_VIDEOS[2]
      },
      {
        title: 'Season 2',
        posterUrl: 'https://picsum.photos/id/16/500/750',
        trailerUrl: DEMO_VIDEOS[3]
      }
    ]
  },
  {
    title: 'The Boys',
    description: 'A group of vigilantes set out to take down corrupt superheroes who abuse their superpowers.',
    thumbnailUrl: 'https://picsum.photos/id/17/500/281',
    releaseYear: 2019,
    seasons: [
      {
        title: 'Season 1',
        posterUrl: 'https://picsum.photos/id/18/500/750',
        trailerUrl: DEMO_VIDEOS[4]
      },
      {
        title: 'Season 2',
        posterUrl: 'https://picsum.photos/id/19/500/750',
        trailerUrl: DEMO_VIDEOS[0]
      }
    ]
  },
  {
    title: 'Game of Thrones',
    description: 'Nine noble families fight for control over the lands of Westeros, while an ancient enemy returns after being dormant for millennia.',
    thumbnailUrl: 'https://picsum.photos/id/20/500/281',
    releaseYear: 2011,
    seasons: [
      {
        title: 'Season 1',
        posterUrl: 'https://picsum.photos/id/21/500/750',
        trailerUrl: DEMO_VIDEOS[1]
      },
      {
        title: 'Season 2',
        posterUrl: 'https://picsum.photos/id/22/500/750',
        trailerUrl: DEMO_VIDEOS[2]
      }
    ]
  },
  {
    title: 'Black Mirror',
    description: 'An anthology series exploring a twisted, high-tech multiverse where humanity\'s greatest innovations and darkest instincts collide.',
    thumbnailUrl: 'https://picsum.photos/id/23/500/281',
    releaseYear: 2011,
    seasons: [
      {
        title: 'Season 1',
        posterUrl: 'https://picsum.photos/id/24/500/750',
        trailerUrl: DEMO_VIDEOS[3]
      },
      {
        title: 'Season 2',
        posterUrl: 'https://picsum.photos/id/25/500/750',
        trailerUrl: DEMO_VIDEOS[4]
      }
    ]
  }
];

async function seedSeries() {
  try {
    console.log('Connecting to MongoDB...', config.database_url);
    await mongoose.connect(config.database_url as string);
    console.log('Connected!');

    // Get a generic genre
    const Genre = mongoose.model('Genre', new mongoose.Schema({}), 'genres');
    let genre = await Genre.findOne();
    const genreId = genre ? genre._id : new mongoose.Types.ObjectId();

    console.log('Cleaning up existing series...');
    const existingSeries = await Content.find({ type: 'SERIES' });
    for (const s of existingSeries) {
      await Season.deleteMany({ seriesId: s._id });
      await Episode.deleteMany({ seriesId: s._id });
      await Content.deleteOne({ _id: s._id });
    }
    console.log('Cleaned up!');

    console.log('Seeding new series...');
    for (const data of SERIES_DATA) {
      const series = await Content.create({
        title: data.title,
        description: data.description,
        type: 'SERIES',
        // NO posterUrl or trailerUrl here anymore according to the new schema!
        thumbnailUrl: data.thumbnailUrl,
        duration: 0,
        releaseYear: data.releaseYear,
        planStatus: ['FREE', 'WEEKLY'],
        status: 'PUBLISHED',
        genres: [genreId],
        views: Math.floor(Math.random() * 50000) + 5000,
        seasonsCount: data.seasons.length,
      });

      console.log(`Created series: ${series.title}`);

      // Create seasons using real diverse data
      let sNum = 1;
      for (const seasonData of data.seasons) {
        const season = await Season.create({
          title: seasonData.title,
          posterUrl: seasonData.posterUrl,
          trailerUrl: seasonData.trailerUrl,
          seriesId: series._id,
          seasonNumber: sNum,
        });

        // Create 3 episodes per season
        for (let eNum = 1; eNum <= 3; eNum++) {
          await Episode.create({
            title: `${series.title} - S0${sNum}E0${eNum}`,
            description: `This is the exciting episode ${eNum} of season ${sNum}.`,
            thumbnailUrl: data.thumbnailUrl,
            videoUrl: DEMO_VIDEOS[Math.floor(Math.random() * DEMO_VIDEOS.length)],
            duration: 45,
            releaseDate: new Date(),
            planStatus: 'FREE',
            status: 'PUBLISHED',
            seriesId: series._id,
            seasonId: season._id,
            seasonNumber: sNum,
            episodeNumber: eNum,
          });
        }
        sNum++;
      }
    }

    console.log('🎉 Series successfully seeded with real media assets!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding series:', error);
    process.exit(1);
  }
}

seedSeries();
