### Security

- **Clearing local data can no longer be undone by a sync request still in flight.** A sign-in, recovery, guest accept, upload or restore that was waiting on the server when local data was cleared now stops without writing anything back.
- **A refused self-hosted upload puts the previous recovery package back.** When the server rejects the backup after its recovery package was replaced, the old package is restored, so the existing backup stays recoverable with its phrase.
- **Ovumcy Cloud no longer offers a key change the server would refuse.** Before the first upload or restore on this device, the recovery action is disabled with a hint to restore or upload first.
- **Upgrading a guest account binds the sync key to the new account.** A key left from another account is replaced, and its new phrase is shown through the usual confirmed reveal.
- **An unfinished restore stays marked across a sign-in to the same account.** The mark is dropped only when the device signs in to a different, known account.
