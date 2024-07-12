#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, Map,
    String, Symbol,
};

extern crate alloc;

#[contract]
pub struct StoryFactoryContract;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotAuthor = 1,
    NotFoundStory = 2,
    NotFoundStoryNft = 3,
    StoryNftSoldOut = 4,
    NotFoundStoryTask = 5,
    StoryTaskDone = 6,
    NotFoundTaskSubmit = 7,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Story {
    pub story_id: u64,
    pub author: Address,
    pub cid: String,
    pub next_task_id: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Task {
    pub id: u64,
    pub cid: String,
    pub creator: Address,
    pub nft_address: Address,
    pub reward_nfts: i128,
    pub status: String,
    pub next_submit_id: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Submit {
    pub id: u64,
    pub cid: String,
    pub creator: Address,
    pub status: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StoryFactory {
    pub next_sid: u64,
    pub stories: Map<u64, Story>,
    pub story_task: Map<String, Task>,
    pub task_submit: Map<String, Submit>,
}

const STATE: Symbol = symbol_short!("STATE");

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Processing(String);
impl Processing {
    pub fn make_task_key(env: &Env, story_id: u64, task_id: u64) -> String {
        let story_task_key = alloc::format!("{},{}", story_id, task_id);
        String::from_str(&env, &story_task_key)
    }

    pub fn make_submit_key(env: &Env, story_id: u64, task_id: u64, submit_id: u64) -> String {
        let submit_key = alloc::format!("{},{},{}", story_id, task_id, submit_id);
        String::from_str(&env, &submit_key)
    }

    pub fn to_alloc_string(value: String) -> alloc::string::String {
        let len = value.len() as usize;
        let mut slice = alloc::vec![0u8; len];
        value.copy_into_slice(&mut slice);
        let new_string = alloc::string::String::from_utf8(slice).unwrap();
        new_string
    }
}

#[contractimpl]
impl StoryFactoryContract {
    pub fn publish_story(env: Env, from: Address, cid: String) -> Result<u64, Error> {
        from.require_auth();
        let mut state = Self::get_state(env.clone());
        let story_id = state.next_sid;
        state.next_sid += 1;
        let story = Story {
            story_id,
            author: from,
            cid,
            next_task_id: 1,
        };
        state.stories.set(story_id, story);
        env.storage().instance().set(&STATE, &state);
        Ok(story_id)
    }

    pub fn update_story(env: Env, from: Address, story_id: u64, cid: String) -> Result<u64, Error> {
        from.require_auth();
        let mut state: StoryFactory = Self::get_state(env.clone());
        if let Some(story) = state.stories.get(story_id) {
            if story.author == from {
                let updated_story = Story {
                    story_id: story.story_id,
                    author: story.author,
                    cid: cid.clone(),
                    next_task_id: story.next_task_id,
                };
                state.stories.set(story_id, updated_story);
                env.storage().instance().set(&STATE, &state);
            } else {
                return Err(Error::NotAuthor);
            }
            Ok(story_id)
        } else {
            Err(Error::NotFoundStory)
        }
    }

    pub fn create_task(
        env: Env,
        from: Address,
        story_id: u64,
        cid: String,
        nft_address: Address,
        reward_nfts: i128,
    ) -> Result<u64, Error> {
        from.require_auth();
        let mut state: StoryFactory = Self::get_state(env.clone());
        if let Some(story) = state.stories.get(story_id) {
            if story.author == from {
                let task = Task {
                    id: story.next_task_id,
                    cid,
                    creator: from.clone(),
                    nft_address: nft_address.clone(),
                    reward_nfts: reward_nfts.clone(),
                    status: String::from_str(&env, "TODO"),
                    next_submit_id: 1,
                };
                let story_task_key =
                    Processing::make_task_key(&env, story_id.clone(), story.next_task_id.clone());
                state.story_task.set(story_task_key, task);
                let updated_story = Story {
                    story_id: story.story_id,
                    author: story.author,
                    cid: story.cid,
                    next_task_id: story.next_task_id + 1,
                };
                state.stories.set(story_id, updated_story);
                env.storage().instance().set(&STATE, &state);
            } else {
                return Err(Error::NotAuthor);
            }
            Ok(story_id)
        } else {
            Err(Error::NotFoundStory)
        }
    }

    pub fn update_task(
        env: Env,
        from: Address,
        story_id: u64,
        task_id: u64,
        cid: String,
    ) -> Result<u64, Error> {
        from.require_auth();
        let mut state: StoryFactory = Self::get_state(env.clone());
        let story_task_key = Processing::make_task_key(&env, story_id.clone(), task_id.clone());
        if let Some(task_info) = state.story_task.get(story_task_key.clone()) {
            if task_info.creator == from {
                let updated_task = Task {
                    id: task_id,
                    cid,
                    creator: from,
                    nft_address: task_info.nft_address,
                    reward_nfts: task_info.reward_nfts,
                    status: task_info.status,
                    next_submit_id: task_info.next_submit_id,
                };
                state.story_task.set(story_task_key, updated_task);
                env.storage().instance().set(&STATE, &state);
                Ok(story_id)
            } else {
                return Err(Error::NotAuthor);
            }
        } else {
            return Err(Error::NotFoundStoryTask);
        }
    }

    pub fn cancel_task(env: Env, from: Address, story_id: u64, task_id: u64) -> Result<u64, Error> {
        from.require_auth();
        let mut state: StoryFactory = Self::get_state(env.clone());
        let story_task_key = Processing::make_task_key(&env, story_id.clone(), task_id.clone());
        if let Some(task_info) = state.story_task.get(story_task_key.clone()) {
            if task_info.creator == from {
                let updated_task = Task {
                    id: task_id,
                    cid: task_info.cid,
                    creator: from,
                    nft_address: task_info.nft_address,
                    reward_nfts: task_info.reward_nfts,
                    status: String::from_str(&env, "CANCELLED"),
                    next_submit_id: task_info.next_submit_id,
                };
                state.story_task.set(story_task_key, updated_task);
                env.storage().instance().set(&STATE, &state);
                Ok(story_id)
            } else {
                return Err(Error::NotAuthor);
            }
        } else {
            return Err(Error::NotFoundStoryTask);
        }
    }

    pub fn create_task_submit(
        env: Env,
        from: Address,
        story_id: u64,
        task_id: u64,
        cid: String,
    ) -> Result<u64, Error> {
        from.require_auth();
        let mut state: StoryFactory = Self::get_state(env.clone());
        let story_task_key = Processing::make_task_key(&env, story_id.clone(), task_id.clone());
        if let Some(task_info) = state.story_task.get(story_task_key.clone()) {
            if task_info.status != String::from_str(&env, "TODO") {
                return Err(Error::StoryTaskDone);
            }
            let submit_id = task_info.next_submit_id;
            let submit = Submit {
                id: submit_id,
                cid,
                creator: from,
                status: String::from_str(&env, "PENDING"),
            };
            let submit_key = Processing::make_submit_key(
                &env,
                story_id.clone(),
                task_id.clone(),
                submit_id.clone(),
            );
            let updated_task = Task {
                id: task_info.id,
                cid: task_info.cid,
                creator: task_info.creator,
                nft_address: task_info.nft_address,
                reward_nfts: task_info.reward_nfts,
                status: task_info.status,
                next_submit_id: task_info.next_submit_id + 1,
            };
            state.task_submit.set(submit_key, submit);
            state.story_task.set(story_task_key, updated_task);
            env.storage().instance().set(&STATE, &state);
            Ok(story_id)
        } else {
            return Err(Error::NotFoundStoryTask);
        }
    }

    pub fn withdraw_task_submit(
        env: Env,
        from: Address,
        story_id: u64,
        task_id: u64,
        submit_id: u64,
    ) -> Result<u64, Error> {
        from.require_auth();
        let mut state: StoryFactory = Self::get_state(env.clone());
        let submit_key =
            Processing::make_submit_key(&env, story_id.clone(), task_id.clone(), submit_id.clone());
        if let Some(submit_info) = state.task_submit.get(submit_key.clone()) {
            if submit_info.creator == from {
                let updated_submit = Submit {
                    id: submit_info.id,
                    cid: submit_info.cid,
                    creator: submit_info.creator,
                    status: String::from_str(&env, "WITHDRAWED"),
                };
                state.task_submit.set(submit_key, updated_submit);
                env.storage().instance().set(&STATE, &state);
                Ok(story_id)
            } else {
                return Err(Error::NotAuthor);
            }
        } else {
            return Err(Error::NotFoundTaskSubmit);
        }
    }

    pub fn mark_task_done(
        env: Env,
        from: Address,
        story_id: u64,
        task_id: u64,
        submit_id: u64,
    ) -> Result<u64, Error> {
        from.require_auth();
        let mut state: StoryFactory = Self::get_state(env.clone());
        let story_task_key = Processing::make_task_key(&env, story_id.clone(), task_id.clone());
        let submit_key =
            Processing::make_submit_key(&env, story_id.clone(), task_id.clone(), submit_id.clone());
        if let Some(task_info) = state.story_task.get(story_task_key.clone()) {
            if task_info.creator != from {
                return Err(Error::NotAuthor);
            }
            if let Some(submit_info) = state.task_submit.get(submit_key.clone()) {
                let updated_task = Task {
                    id: task_info.id,
                    cid: task_info.cid,
                    creator: task_info.creator,
                    nft_address: task_info.nft_address,
                    reward_nfts: task_info.reward_nfts,
                    status: String::from_str(&env, "DONE"),
                    next_submit_id: task_info.next_submit_id,
                };
                let upadted_submit = Submit {
                    id: submit_info.id,
                    cid: submit_info.cid,
                    creator: submit_info.creator,
                    status: String::from_str(&env, "APPROVED"),
                };
                state.task_submit.set(submit_key, upadted_submit);
                state.story_task.set(story_task_key, updated_task);
                env.storage().instance().set(&STATE, &state);
                Ok(story_id)
            } else {
                return Err(Error::NotFoundTaskSubmit);
            }
        } else {
            return Err(Error::NotFoundStoryTask);
        }
    }

    pub fn get_state(env: Env) -> StoryFactory {
        env.storage().instance().get(&STATE).unwrap_or_else(|| {
            let mut factory = StoryFactory {
                next_sid: 1,
                stories: Map::new(&env),
                story_task: Map::new(&env),
                task_submit: Map::new(&env),
            };
        })
    }
}
