import asyncio
from pyrogram import Client
from pyrogram.handlers import RawUpdateHandler
import logging

logging.basicConfig(level=logging.INFO)

async def main():
    # connect to the test or dev influencer
    client = Client("Sophia", workdir="data/sessions")
    
    async def raw_update_handler(client, update, users, chats):
        update_name = type(update).__name__
        if "Phone" in update_name or "Call" in update_name:
            print(f"PHONE CALL UPDATE CAUGHT! {update_name}")

    client.add_handler(RawUpdateHandler(raw_update_handler))
    
    await client.start()
    print("Test client started, waiting for updates... (Call Sophia now!)")
    await asyncio.sleep(60)
    await client.stop()

if __name__ == "__main__":
    asyncio.run(main())
