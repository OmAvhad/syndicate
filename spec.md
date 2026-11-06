We have now connected to arkiv
also we have developed a follower relationship


now we have to develop a page where a leader can place a trade/order
with a following fields - limit, symbol, stop loss, target, burner account address etc

After placing trades it should trigger "/promise" api in this api send payload of the above trade details but hash it before sending store a hash key in the .env
wait for promise response (mock it for now), after getting success trigger to api calls simultaneously
1. trade execution (mock it for now - send the smae payload for which we sent for promise)
2. trade signal - send signal to followers about the trade (this trade should be encrypted by the follower's public key),
    after encryption save it in ArkDB with hash key (id)
    we will be storing it in a new table, create a table with following columns
    id, encryptedTradeSignal, leader publickey, follower publickey, ttl (time-to-live)
    timetolive should only be for 10 minutes
    Using websockets send the trade signal to the user decrypt it for the user and show on UI only till its time to live
    the user will get only ttl to execute that trade
    if the user executes the trade call trade-execution api and send the trade details, the user can change the amount details and send order

