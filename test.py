from lithops import Storage

if __name__ == "__main__":
    st = Storage()
    st.put_object(
        bucket="mybucket",
        key="test.txt",
        body="Hello World",
    )

    print(st.get_object(bucket="lithops", key="test.txt"))
